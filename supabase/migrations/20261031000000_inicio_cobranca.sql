-- Sem Panela: mês em que a cobrança pelo app começa e jogador isento.
-- Quem começa a usar no meio do mês não quer ver o mês inteiro "em aberto" para todo mundo.
-- Vazio = cobra desde sempre (como era antes). Sempre o dia 1 do mês.
-- Rode no SQL Editor do Supabase depois de 20261028120000_notificacoes_push.sql.

alter table public.groups add column billing_start date
  check (billing_start is null or extract(day from billing_start) = 1);
grant update (billing_start) on public.groups to authenticated;

-- Jogador isento (goleiro convidado, dono da quadra...): joga, mas nunca entra na cobrança.
-- Só o organizador muda (a RLS de members já só deixa o organizador editar).
alter table public.members add column exempt boolean not null default false;
grant update (exempt) on public.members to authenticated;
