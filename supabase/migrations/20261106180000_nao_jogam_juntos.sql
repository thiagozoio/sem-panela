-- Sem Panela: regras do sorteio "estes dois não jogam no mesmo time".
-- Rode no SQL Editor do Supabase depois de 20261106120000_gol_contra.sql.
-- Só os organizadores veem e mexem (os jogadores não sabem das regras).

create table public.member_apart (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  member_a uuid not null references public.members (id) on delete cascade,
  member_b uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (member_a < member_b),
  unique (member_a, member_b)
);
grant select, insert, delete on public.member_apart to authenticated, service_role;
create index member_apart_group on public.member_apart (group_id);

alter table public.member_apart enable row level security;

create policy "regra sorteio: organizador lê" on public.member_apart
  for select to authenticated using (public.is_organizer(group_id));
create policy "regra sorteio: organizador cria" on public.member_apart
  for insert to authenticated
  with check (public.is_organizer(group_id) and public.is_writable(group_id)
              and public.member_group(member_a) = group_id
              and public.member_group(member_b) = group_id);
create policy "regra sorteio: organizador apaga" on public.member_apart
  for delete to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id));
