-- Sem Panela: mais de um organizador, times fixos do mês, gastos e valor pago manual.
-- Rode no SQL Editor do Supabase depois do 20261014000000_init.sql.

-- ---------------------------------------------------------------------------
-- Organizadores: qualquer organizador promove ou tira outro, mas sempre sobra um
-- ---------------------------------------------------------------------------

create function public.set_organizer(p_member_id uuid, p_value boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
begin
  select * into m from public.members where id = p_member_id;
  if m.id is null or not public.is_organizer(m.group_id) or not public.is_writable(m.group_id) then
    raise exception 'sem acesso';
  end if;
  if p_value then
    if m.user_id is null or not m.active then
      raise exception 'o jogador precisa ter entrado pelo convite';
    end if;
  elsif not exists (
    select 1 from public.members o
    where o.group_id = m.group_id and o.id <> m.id and o.is_organizer and o.active
  ) then
    raise exception 'o grupo precisa de pelo menos um organizador';
  end if;
  update public.members set is_organizer = p_value where id = p_member_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Times fixos do mês (nome escolhido pelo organizador)
-- ---------------------------------------------------------------------------

create table public.fixed_teams (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  name text not null check (char_length(name) between 1 and 30),
  sort smallint not null default 0,
  member_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index fixed_teams_group_month_idx on public.fixed_teams (group_id, month);

alter table public.fixed_teams enable row level security;
create policy "time fixo: membros leem" on public.fixed_teams
  for select to authenticated using (public.is_member(group_id));
create policy "time fixo: organizador cria" on public.fixed_teams
  for insert to authenticated
  with check (public.is_organizer(group_id) and public.is_writable(group_id));
create policy "time fixo: organizador edita" on public.fixed_teams
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id))
  with check (public.is_organizer(group_id));
create policy "time fixo: organizador apaga" on public.fixed_teams
  for delete to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id));
revoke update on public.fixed_teams from authenticated;
grant update (name, sort, member_ids) on public.fixed_teams to authenticated;

-- ---------------------------------------------------------------------------
-- Gastos do mês (quadra, bola, juiz...)
-- ---------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  description text not null check (char_length(description) between 1 and 80),
  amount_cents integer not null check (amount_cents >= 0),
  created_at timestamptz not null default now()
);
create index expenses_group_month_idx on public.expenses (group_id, month);

alter table public.expenses enable row level security;
create policy "gasto: organizador lê" on public.expenses
  for select to authenticated using (public.is_organizer(group_id));
create policy "gasto: organizador registra" on public.expenses
  for insert to authenticated
  with check (public.is_organizer(group_id) and public.is_writable(group_id));
create policy "gasto: organizador apaga" on public.expenses
  for delete to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id));
revoke update on public.expenses from authenticated;

-- ---------------------------------------------------------------------------
-- Pagamentos: valor digitado à mão (multa por atraso, desconto) com observação
-- ---------------------------------------------------------------------------

alter table public.payments
  add column note text not null default '' check (char_length(note) <= 60);

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
