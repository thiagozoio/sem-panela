-- Sem Panela: modalidade da pelada (futsal, society, campo, vôlei) e posições de cada uma.
-- Rode no SQL Editor do Supabase depois de 20261019000000_caixa_notas_gols.sql.

-- Modalidade do grupo; os grupos que já existem ficam como society.
alter table public.groups add column sport text not null default 'society'
  check (sport in ('futsal', 'society', 'campo', 'volei'));
grant update (sport) on public.groups to authenticated;

-- Posições: "linha" continua sendo a coringa (joga onde precisar).
alter table public.members drop constraint if exists members_position_check;
alter table public.members add constraint members_position_check check (position in (
  'linha', 'goleiro',
  'fixo', 'ala', 'pivo',
  'zagueiro', 'lateral', 'volante', 'meio', 'atacante',
  'levantador', 'oposto', 'ponteiro', 'central', 'libero'
));
