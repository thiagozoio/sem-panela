-- Sem Panela: preço novo (R$ 29,90) e preço de fundador (R$ 19,90 para sempre) para os
-- 10 primeiros grupos que assinam pelo app.
-- Rode no SQL Editor do Supabase depois de 20261122000000_historico_alteracoes.sql.
-- Pode rodar mais de uma vez sem problema.

-- ---------------------------------------------------------------------------
-- 1. Valor de cada assinatura (o que foi combinado no Asaas)
-- Assinaturas que já existem foram criadas a R$ 19,90: ficam com esse valor.
-- ---------------------------------------------------------------------------

alter table public.billing_accounts add column if not exists price_cents integer;
update public.billing_accounts set price_cents = 1990 where price_cents is null;

-- ---------------------------------------------------------------------------
-- 2. Grupos fundadores (no máximo 10). Uma vaga é de quem assinou primeiro.
-- Só o servidor grava; o organizador lê se o próprio grupo é fundador.
-- ---------------------------------------------------------------------------

create table if not exists public.billing_founders (
  group_id uuid primary key references public.groups (id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.billing_founders to authenticated, service_role;
revoke all on public.billing_founders from anon;
revoke insert, update, delete on public.billing_founders from authenticated;

alter table public.billing_founders enable row level security;
drop policy if exists "fundador: organizador lê" on public.billing_founders;
create policy "fundador: organizador lê" on public.billing_founders
  for select to authenticated using (public.is_organizer(group_id) or public.is_admin());

-- Vagas que sobram (aparece na página inicial e na assinatura).
create or replace function public.founder_spots_left() returns int
language sql stable security definer set search_path = '' as $$
  select greatest(0, 10 - (select count(*) from public.billing_founders))::int;
$$;

-- Pega uma vaga para o grupo, se ainda tiver. Já fundador: continua (true).
-- A trava garante que dois grupos assinando ao mesmo tempo não passem de 10.
create or replace function public.billing_claim_founder(p_group_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('sem-panela:fundadores'));
  if exists (select 1 from public.billing_founders where group_id = p_group_id) then
    return true;
  end if;
  if (select count(*) from public.billing_founders) >= 10 then
    return false;
  end if;
  insert into public.billing_founders (group_id) values (p_group_id);
  return true;
end;
$$;

-- Devolve a vaga de quem assinou e cancelou sem nunca ter pago. Quem já pagou uma vez
-- continua fundador para sempre, mesmo se cancelar e voltar depois.
create or replace function public.billing_release_founder(p_group_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.billing_payments where group_id = p_group_id and status = 'applied') then
    return false;
  end if;
  delete from public.billing_founders where group_id = p_group_id;
  return found;
end;
$$;

revoke execute on function public.founder_spots_left() from public;
grant execute on function public.founder_spots_left() to anon, authenticated, service_role;
revoke execute on function public.billing_claim_founder(uuid) from anon, public, authenticated;
revoke execute on function public.billing_release_founder(uuid) from anon, public, authenticated;
grant execute on function public.billing_claim_founder(uuid) to service_role;
grant execute on function public.billing_release_founder(uuid) to service_role;
