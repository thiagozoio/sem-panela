-- Sem Panela: classificação da pelada (campeão do mês ou campeonatos com datas).
-- Rode no SQL Editor do Supabase depois de 20261019120000_modalidades.sql.

-- Opção do organizador: 'off' (sem classificação), 'mensal' (campeão do mês)
-- ou 'campeonato' (campeonatos com início e fim, como 1º e 2º turno).
alter table public.groups add column ranking text not null default 'off'
  check (ranking in ('off', 'mensal', 'campeonato'));
grant update (ranking) on public.groups to authenticated;

-- Campeonatos: só o período. A tabela sai dos placares dos jogos dentro dele.
create table public.championships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
grant select, insert, update, delete on public.championships to authenticated, service_role;
create index championships_group_idx on public.championships (group_id, starts_on);

alter table public.championships enable row level security;
create policy "campeonato: membros leem" on public.championships
  for select to authenticated using (public.is_member(group_id));
create policy "campeonato: organizador cria" on public.championships
  for insert to authenticated
  with check (public.is_organizer(group_id) and public.is_writable(group_id));
create policy "campeonato: organizador edita" on public.championships
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id))
  with check (public.is_organizer(group_id));
create policy "campeonato: organizador apaga" on public.championships
  for delete to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id));
revoke update on public.championships from authenticated;
grant update (name, starts_on, ends_on) on public.championships to authenticated;
