-- Sem Panela: convidado de um jogo só.
-- Quando faltar gente, o organizador põe um convidado direto na lista do jogo.
-- O convidado é um jogador marcado com guest = true: entra na lista, no sorteio e na
-- mensagem do WhatsApp, mas não aparece em Jogadores, nos pendentes nem nos times do mês.
-- Paga o avulso do jogo (a não ser que o organizador marque como isento).
-- Rode no SQL Editor do Supabase depois de 20261031000000_inicio_cobranca.sql.

alter table public.members add column guest boolean not null default false;
grant update (guest) on public.members to authenticated;
