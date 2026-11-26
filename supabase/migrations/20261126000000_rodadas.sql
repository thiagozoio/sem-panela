-- Formato do jogo e partidas do dia (rodadas).
-- "unico": um placar só no dia (como sempre foi).
-- "todos": várias partidas curtas no mesmo dia, todos contra todos.
-- "fica": várias partidas curtas, quem ganha fica.
-- round_goals: a partida acaba quando um time chega a esse número de gols (vazio = sem limite).

alter table public.groups
  add column if not exists game_format text not null default 'unico'
    check (game_format in ('unico', 'todos', 'fica')),
  add column if not exists round_goals smallint
    check (round_goals between 1 and 20);
grant update (game_format, round_goals) on public.groups to authenticated;

-- Cada partida do dia: dois times do jogo (posição em games.teams) e o placar dela.
-- goals / own_goals: gols de cada jogador nesta partida ({member_id: gols}), para tirar
-- da artilharia se a partida for apagada.
create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  seq smallint not null check (seq between 1 and 200),
  home smallint not null check (home between 0 and 19),
  away smallint not null check (away between 0 and 19),
  home_score smallint not null default 0 check (home_score between 0 and 99),
  away_score smallint not null default 0 check (away_score between 0 and 99),
  goals jsonb not null default '{}'::jsonb,
  own_goals jsonb not null default '{}'::jsonb,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  check (home <> away),
  unique (game_id, seq)
);
grant select, insert, update, delete on public.game_rounds to authenticated, service_role;
create index if not exists game_rounds_game_idx on public.game_rounds (game_id, seq);

alter table public.game_rounds enable row level security;
drop policy if exists "partida: membros leem" on public.game_rounds;
create policy "partida: membros leem" on public.game_rounds
  for select to authenticated using (public.is_member(group_id));
drop policy if exists "partida: organizador cria" on public.game_rounds;
create policy "partida: organizador cria" on public.game_rounds
  for insert to authenticated
  with check (
    public.is_organizer(group_id) and public.is_writable(group_id)
    and exists (select 1 from public.games g where g.id = game_id and g.group_id = game_rounds.group_id)
  );
drop policy if exists "partida: organizador edita" on public.game_rounds;
create policy "partida: organizador edita" on public.game_rounds
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id))
  with check (public.is_organizer(group_id));
drop policy if exists "partida: organizador apaga" on public.game_rounds;
create policy "partida: organizador apaga" on public.game_rounds
  for delete to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id));
