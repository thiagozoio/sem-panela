-- Sem Panela: cobrança automática da assinatura pelo Asaas (Pix ou cartão).
-- Rode no SQL Editor do Supabase depois de 20261106180000_nao_jogam_juntos.sql
-- (pode rodar antes ou depois de 20261108000000_seguranca.sql).
--
-- Quem mexe nestas tabelas é só o servidor (chave secreta), pelo botão "Assinar" e pelo
-- aviso (webhook) do Asaas. O organizador só lê a assinatura do próprio grupo.

-- ---------------------------------------------------------------------------
-- 1. Assinatura de cada grupo no Asaas
-- ---------------------------------------------------------------------------

create table if not exists public.billing_accounts (
  group_id uuid primary key references public.groups (id) on delete cascade,
  asaas_customer_id text not null,
  asaas_subscription_id text unique,
  billing_type text not null default 'PIX' check (billing_type in ('PIX', 'CREDIT_CARD')),
  cycle text not null default 'MONTHLY' check (cycle in ('MONTHLY', 'YEARLY')),
  status text not null default 'active' check (status in ('active', 'canceled')),
  payer_name text not null default '',
  payer_doc text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.billing_accounts to authenticated, service_role;
revoke all on public.billing_accounts from anon;
revoke insert, update, delete on public.billing_accounts from authenticated;

alter table public.billing_accounts enable row level security;
drop policy if exists "assinatura: organizador lê" on public.billing_accounts;
create policy "assinatura: organizador lê" on public.billing_accounts
  for select to authenticated using (public.is_organizer(group_id) or public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Cobranças pagas que já liberaram o grupo (uma linha por cobrança do Asaas).
-- O Asaas avisa o mesmo pagamento mais de uma vez (cartão: "confirmado" e depois
-- "recebido"; e reenvia se o app demorar). Esta tabela garante que cada cobrança
-- empurra o "pago até" uma vez só, e guarda o valor anterior para desfazer no estorno.
-- ---------------------------------------------------------------------------

create table if not exists public.billing_payments (
  payment_id text primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  due_date date not null,
  months smallint not null check (months between 1 and 12),
  value_cents integer not null default 0,
  paid_until_before date not null,
  paid_until_after date not null,
  status text not null default 'applied' check (status in ('applied', 'reverted')),
  created_at timestamptz not null default now(),
  reverted_at timestamptz
);
grant select, insert, update, delete on public.billing_payments to service_role;
revoke all on public.billing_payments from anon, authenticated;
alter table public.billing_payments enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Registro dos avisos recebidos do Asaas (para conferir depois, se algo der errado)
-- ---------------------------------------------------------------------------

create table if not exists public.billing_events (
  event_id text primary key,
  type text not null,
  payment_id text,
  group_id uuid references public.groups (id) on delete set null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
grant select, insert, update, delete on public.billing_events to service_role;
revoke all on public.billing_events from anon, authenticated;
alter table public.billing_events enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Funções que liberam e desfazem (só o servidor chama)
-- ---------------------------------------------------------------------------

-- Cobrança paga: "pago até" = o maior entre o atual e o vencimento da cobrança, mais o ciclo.
-- Chamar de novo com a mesma cobrança não muda nada. Devolve o "pago até" final.
create or replace function public.billing_apply_payment(
  p_payment_id text, p_group_id uuid, p_due_date date, p_months int, p_value_cents int
) returns date
language plpgsql security definer set search_path = '' as $$
declare
  cur date;
  base date;
  nxt date;
  existing public.billing_payments;
begin
  select * into existing from public.billing_payments where payment_id = p_payment_id;
  if found and existing.status = 'applied' then
    return (select paid_until from public.groups where id = existing.group_id);
  end if;

  select paid_until into cur from public.groups where id = p_group_id for update;
  if cur is null then
    raise exception 'grupo não encontrado';
  end if;
  -- Grupo que já estava só leitura (pagou uma cobrança antiga): o mês conta a partir de hoje,
  -- senão ele pagaria e continuaria bloqueado.
  base := greatest(cur, p_due_date);
  if base + 7 < (now() at time zone 'America/Sao_Paulo')::date then
    base := (now() at time zone 'America/Sao_Paulo')::date;
  end if;
  nxt := (base + make_interval(months => p_months))::date;
  update public.groups set paid_until = nxt where id = p_group_id;

  insert into public.billing_payments
    (payment_id, group_id, due_date, months, value_cents, paid_until_before, paid_until_after, status)
  values (p_payment_id, p_group_id, p_due_date, p_months, p_value_cents, cur, nxt, 'applied')
  on conflict (payment_id) do update set
    due_date = excluded.due_date, months = excluded.months, value_cents = excluded.value_cents,
    paid_until_before = excluded.paid_until_before, paid_until_after = excluded.paid_until_after,
    status = 'applied', reverted_at = null;
  return nxt;
end;
$$;

-- Estorno ou contestação: tira de volta os meses daquela cobrança (sem ir antes do que era).
create or replace function public.billing_revert_payment(p_payment_id text) returns date
language plpgsql security definer set search_path = '' as $$
declare
  p public.billing_payments;
  cur date;
  nxt date;
begin
  select * into p from public.billing_payments where payment_id = p_payment_id for update;
  if not found or p.status = 'reverted' then
    return null;
  end if;
  select paid_until into cur from public.groups where id = p.group_id for update;
  nxt := greatest(p.paid_until_before, (cur - make_interval(months => p.months))::date);
  update public.groups set paid_until = nxt where id = p.group_id;
  update public.billing_payments set status = 'reverted', reverted_at = now() where payment_id = p_payment_id;
  return nxt;
end;
$$;

revoke execute on function public.billing_apply_payment(text, uuid, date, int, int) from anon, public, authenticated;
revoke execute on function public.billing_revert_payment(text) from anon, public, authenticated;
grant execute on function public.billing_apply_payment(text, uuid, date, int, int) to service_role;
grant execute on function public.billing_revert_payment(text) to service_role;
