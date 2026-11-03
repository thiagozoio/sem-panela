-- Sem Panela: convidado de um jogo só e sócio (só paga a mensalidade, não joga).
-- Rode no SQL Editor do Supabase depois de 20261031000000_inicio_cobranca.sql.

-- Convidado: quando faltar gente, o organizador põe um convidado direto na lista do jogo.
-- É um jogador marcado com guest = true: entra na lista, no sorteio/time e na mensagem do
-- WhatsApp, mas não aparece em Jogadores, nos pendentes nem na cobrança (não paga).
alter table public.members add column guest boolean not null default false;
grant update (guest) on public.members to authenticated;

-- Sócio: paga a mensalidade (para participar dos eventos do time), mas não joga as peladas.
-- Entra na cobrança mensal e fica fora da lista de presença, dos avisos de jogo e dos times.
alter table public.members drop constraint if exists members_kind_check;
alter table public.members add constraint members_kind_check
  check (kind in ('mensalista', 'avulso', 'socio'));
