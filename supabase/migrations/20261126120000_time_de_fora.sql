-- Formato "fora": o jogo da semana é sempre contra um time de fora.
-- O nome do adversário fica em games.opponent; o placar em games.scores (nós, eles).

alter table public.groups drop constraint if exists groups_game_format_check;
alter table public.groups add constraint groups_game_format_check
  check (game_format in ('unico', 'todos', 'fica', 'fora'));

alter table public.games
  add column if not exists opponent text check (char_length(opponent) <= 60);
grant update (opponent) on public.games to authenticated;
