-- Sem Panela: jogos contra outros times (amistosos) e telefone dos jogadores.
-- Rode no SQL Editor do Supabase depois de 20261019180000_classificacao.sql.

-- Opção do organizador: liga a aba "Amistosos" para quem joga contra outras equipes.
alter table public.groups add column matches boolean not null default false;
grant update (matches) on public.groups to authenticated;

-- Telefone do jogador fica numa tabela à parte, como o nível: só o organizador lê e escreve.
create table public.member_contacts (
  member_id uuid primary key references public.members (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  phone text not null default '' check (char_length(phone) <= 30)
);

alter table public.member_contacts enable row level security;
create policy "telefone: organizador lê" on public.member_contacts
  for select to authenticated using (public.is_organizer(group_id));
create policy "telefone: organizador cria" on public.member_contacts
  for insert to authenticated
  with check (public.is_organizer(group_id) and public.is_writable(group_id)
              and public.member_group(member_id) = group_id);
create policy "telefone: organizador edita" on public.member_contacts
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id));
revoke update on public.member_contacts from authenticated;
grant update (phone) on public.member_contacts to authenticated;

-- Amistosos: jogos marcados contra outro time, com o contato de lá e, depois, o placar.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  starts_at timestamptz not null,
  opponent text not null check (char_length(opponent) between 1 and 60),
  location text not null default '' check (char_length(location) <= 120),
  contact_name text not null default '' check (char_length(contact_name) <= 60),
  contact_phone text not null default '' check (char_length(contact_phone) <= 30),
  notes text not null default '' check (char_length(notes) <= 280),
  our_score smallint check (our_score between 0 and 99),
  their_score smallint check (their_score between 0 and 99),
  created_at timestamptz not null default now(),
  check ((our_score is null) = (their_score is null))
);
create index matches_group_idx on public.matches (group_id, starts_at);

alter table public.matches enable row level security;
create policy "amistoso: membros leem" on public.matches
  for select to authenticated using (public.is_member(group_id));
create policy "amistoso: organizador marca" on public.matches
  for insert to authenticated
  with check (public.is_organizer(group_id) and public.is_writable(group_id));
create policy "amistoso: organizador edita" on public.matches
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id))
  with check (public.is_organizer(group_id));
create policy "amistoso: organizador apaga" on public.matches
  for delete to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id));
revoke update on public.matches from authenticated;
grant update (starts_at, opponent, location, contact_name, contact_phone, notes, our_score, their_score)
  on public.matches to authenticated;
