-- Sem Panela: como sai o campeão de cada campeonato (tabela, jogo final ou escolhido à mão).
-- Rode no SQL Editor do Supabase depois de 20261103000000_convidados.sql.

alter table public.championships
  add column decided_by text not null default 'tabela' check (decided_by in ('tabela', 'final', 'manual')),
  add column final_game_id uuid references public.games (id) on delete set null,
  add column champion_ids uuid[] not null default '{}';
grant update (decided_by, final_game_id, champion_ids) on public.championships to authenticated;
