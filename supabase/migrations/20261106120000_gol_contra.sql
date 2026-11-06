-- Sem Panela: gol contra por jogador (conta para o outro time, não entra na artilharia).
-- Rode no SQL Editor do Supabase. A linha do jogador pode ter só gol contra (goals = 0).

alter table public.game_goals add column own_goals smallint not null default 0 check (own_goals between 0 and 50);
alter table public.game_goals drop constraint if exists game_goals_goals_check;
alter table public.game_goals add constraint game_goals_goals_check check (goals between 0 and 50);
alter table public.game_goals add constraint game_goals_algum_gol check (goals > 0 or own_goals > 0);

grant update (goals, own_goals) on public.game_goals to authenticated;
