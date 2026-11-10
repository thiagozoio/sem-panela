-- Sem Panela: o time escolhido para um convidado vale só para aquele jogo.
-- Antes ele era guardado no time fixo do mês e ficava lá para os outros jogos.
-- Rode no SQL Editor do Supabase (tudo de uma vez).

-- 1. Time do convidado neste jogo (só usado para convidados, antes de ter sorteio).
alter table public.attendances add column if not exists team text check (char_length(team) between 1 and 30);
grant update (team) on public.attendances to authenticated;

-- 2. Convidados que estavam em times fixos: o time passa para a presença deles nos jogos
--    daquele mês que ainda não têm times salvos (para o placar desses jogos continuar certo).
update public.attendances a
set team = f.name
from public.games g, public.fixed_teams f, public.members m
where a.game_id = g.id
  and g.teams is null
  and m.id = a.member_id
  and m.guest
  and f.group_id = g.group_id
  and f.month = date_trunc('month', g.starts_at at time zone 'America/Sao_Paulo')::date
  and a.member_id = any (f.member_ids)
  and a.team is null;

-- 3. Tira os convidados dos times fixos.
update public.fixed_teams f
set member_ids = array(
  select id from unnest(f.member_ids) with ordinality as t(id, n)
  where not exists (select 1 from public.members m where m.id = t.id and m.guest)
  order by n
)
where exists (select 1 from public.members m where m.id = any (f.member_ids) and m.guest);
