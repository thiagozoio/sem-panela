-- Sem Panela: esquema inicial do MVP.
-- Rode no SQL Editor do Supabase (ou `supabase db push`).

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  location text not null default '',
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  max_players smallint not null default 20 check (max_players between 4 and 80),
  players_per_team smallint not null default 6 check (players_per_team between 2 and 11),
  -- mensalistas que confirmam antes de (jogo - priority_hours) passam na frente dos avulsos
  priority_hours smallint not null default 24 check (priority_hours between 0 and 168),
  monthly_fee_cents integer not null default 0 check (monthly_fee_cents >= 0),
  single_fee_cents integer not null default 0 check (single_fee_cents >= 0),
  pix_key text not null default '',
  invite_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  owner_id uuid not null references auth.users (id),
  -- assinatura do organizador: começa com 30 dias de teste, o admin estende à mão
  paid_until date not null default (current_date + 30),
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  position text not null default 'linha' check (position in ('linha', 'goleiro')),
  kind text not null default 'avulso' check (kind in ('mensalista', 'avulso')),
  is_organizer boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index members_user_idx on public.members (user_id);

-- Nível do jogador fica numa tabela à parte: só o organizador lê e escreve.
create table public.member_skills (
  member_id uuid primary key references public.members (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  skill smallint not null default 3 check (skill between 1 and 5)
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  starts_at timestamptz not null,
  teams jsonb,
  created_at timestamptz not null default now(),
  unique (group_id, starts_at)
);

create table public.attendances (
  game_id uuid not null references public.games (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  going boolean not null,
  confirmed_at timestamptz not null default now(),
  primary key (game_id, member_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  kind text not null check (kind in ('mensal', 'avulso')),
  month date,
  game_id uuid references public.games (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  paid_at timestamptz not null default now(),
  check (
    (kind = 'mensal' and month is not null and game_id is null)
    or (kind = 'avulso' and game_id is not null and month is null)
  ),
  unique (member_id, month),
  unique (member_id, game_id)
);
create index payments_group_idx on public.payments (group_id);

-- ---------------------------------------------------------------------------
-- Perfil criado automaticamente no primeiro login
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Funções de permissão (security definer para não cair em recursão de RLS)
-- ---------------------------------------------------------------------------

create function public.is_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.group_id = gid and m.user_id = auth.uid() and m.active
  );
$$;

create function public.is_organizer(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.group_id = gid and m.user_id = auth.uid() and m.active and m.is_organizer
  );
$$;

-- Grupo com assinatura vencida há mais de 7 dias fica só leitura.
create function public.is_writable(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.groups g
    where g.id = gid and g.paid_until + 7 >= (now() at time zone 'America/Sao_Paulo')::date
  );
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create function public.game_group(gid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select g.group_id from public.games g where g.id = gid;
$$;

create function public.member_user(mid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id from public.members m where m.id = mid;
$$;

create function public.member_group(mid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.group_id from public.members m where m.id = mid;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.member_skills enable row level security;
alter table public.games enable row level security;
alter table public.attendances enable row level security;
alter table public.payments enable row level security;

-- profiles
create policy "perfil: ler o próprio" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "perfil: editar o próprio" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;

-- groups (criação via create_group; paid_until só o admin muda)
create policy "grupo: membros leem" on public.groups
  for select to authenticated using (public.is_member(id) or public.is_admin());
create policy "grupo: organizador edita" on public.groups
  for update to authenticated
  using (public.is_organizer(id) and public.is_writable(id))
  with check (public.is_organizer(id));
create policy "grupo: organizador apaga" on public.groups
  for delete to authenticated using (public.is_organizer(id));
revoke insert, update on public.groups from authenticated;
grant update (name, location, weekday, start_time, max_players, players_per_team,
  priority_hours, monthly_fee_cents, single_fee_cents, pix_key)
  on public.groups to authenticated;

-- members
create policy "jogador: membros leem" on public.members
  for select to authenticated using (public.is_member(group_id));
create policy "jogador: organizador cria" on public.members
  for insert to authenticated
  with check (public.is_organizer(group_id) and public.is_writable(group_id));
create policy "jogador: organizador edita" on public.members
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id))
  with check (public.is_organizer(group_id));
create policy "jogador: organizador apaga" on public.members
  for delete to authenticated
  using (public.is_organizer(group_id) and not is_organizer and public.is_writable(group_id));
revoke update on public.members from authenticated;
grant update (name, position, kind, active) on public.members to authenticated;

-- member_skills: só o organizador
create policy "nível: organizador lê" on public.member_skills
  for select to authenticated using (public.is_organizer(group_id));
create policy "nível: organizador cria" on public.member_skills
  for insert to authenticated
  with check (public.is_organizer(group_id) and public.is_writable(group_id)
              and public.member_group(member_id) = group_id);
create policy "nível: organizador edita" on public.member_skills
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id));
revoke update on public.member_skills from authenticated;
grant update (skill) on public.member_skills to authenticated;

-- games (criação via ensure_next_game)
create policy "jogo: membros leem" on public.games
  for select to authenticated using (public.is_member(group_id));
create policy "jogo: organizador edita" on public.games
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id))
  with check (public.is_organizer(group_id));
revoke insert, update on public.games from authenticated;
grant update (teams) on public.games to authenticated;

-- attendances: o próprio jogador ou o organizador
create policy "presença: membros leem" on public.attendances
  for select to authenticated using (public.is_member(public.game_group(game_id)));
create policy "presença: confirmar" on public.attendances
  for insert to authenticated
  with check (
    public.member_group(member_id) = public.game_group(game_id)
    and public.is_writable(public.game_group(game_id))
    and (public.member_user(member_id) = auth.uid()
         or public.is_organizer(public.game_group(game_id)))
  );
create policy "presença: mudar" on public.attendances
  for update to authenticated
  using (
    public.is_writable(public.game_group(game_id))
    and (public.member_user(member_id) = auth.uid()
         or public.is_organizer(public.game_group(game_id)))
  );
create policy "presença: apagar" on public.attendances
  for delete to authenticated
  using (
    public.is_writable(public.game_group(game_id))
    and (public.member_user(member_id) = auth.uid()
         or public.is_organizer(public.game_group(game_id)))
  );
revoke update on public.attendances from authenticated;
grant update (going, confirmed_at) on public.attendances to authenticated;

-- payments: organizador gerencia, jogador vê os próprios
create policy "pagamento: ler" on public.payments
  for select to authenticated
  using (public.is_organizer(group_id) or public.member_user(member_id) = auth.uid());
create policy "pagamento: organizador registra" on public.payments
  for insert to authenticated
  with check (
    public.is_organizer(group_id) and public.is_writable(group_id)
    and public.member_group(member_id) = group_id
    and (game_id is null or public.game_group(game_id) = group_id)
  );
create policy "pagamento: organizador apaga" on public.payments
  for delete to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create function public.create_group(
  p_name text, p_location text, p_weekday smallint, p_start_time time,
  p_max_players smallint, p_organizer_name text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  insert into public.groups (name, location, weekday, start_time, max_players, owner_id)
  values (p_name, coalesce(p_location, ''), p_weekday, p_start_time, p_max_players, auth.uid())
  returning id into gid;
  insert into public.members (group_id, user_id, name, kind, is_organizer)
  values (gid, auth.uid(), p_organizer_name, 'mensalista', true);
  return gid;
end;
$$;

-- Dados mínimos para a tela de convite (quem ainda não é membro não lê o grupo).
create function public.invite_info(p_code text)
returns table (group_id uuid, group_name text, already_member boolean, unclaimed jsonb)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name,
    exists (select 1 from public.members m where m.group_id = g.id and m.user_id = auth.uid()),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name) order by m.name)
      from public.members m
      where m.group_id = g.id and m.user_id is null and m.active
    ), '[]'::jsonb)
  from public.groups g
  where g.invite_code = p_code;
$$;

-- Entra no grupo pelo código. Se p_member_id vier, assume um jogador já cadastrado
-- pelo organizador (que ainda não tinha conta).
create function public.join_group(p_code text, p_name text, p_member_id uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  select id into gid from public.groups where invite_code = p_code;
  if gid is null then
    raise exception 'convite inválido';
  end if;
  if exists (select 1 from public.members where group_id = gid and user_id = auth.uid()) then
    return gid;
  end if;
  if p_member_id is not null then
    update public.members set user_id = auth.uid()
    where id = p_member_id and group_id = gid and user_id is null;
    if found then
      return gid;
    end if;
  end if;
  insert into public.members (group_id, user_id, name)
  values (gid, auth.uid(), p_name);
  return gid;
end;
$$;

-- Próximo jogo do grupo (cria se não existir). O jogo continua "atual" até 3h
-- depois do horário de início; depois disso abre a lista da semana seguinte.
create function public.ensure_next_game(p_group_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
  local_now timestamp;
  d date;
  starts timestamptz;
  game_id uuid;
begin
  if not public.is_member(p_group_id) then
    raise exception 'sem acesso';
  end if;
  select * into g from public.groups where id = p_group_id;
  local_now := (now() at time zone 'America/Sao_Paulo') - interval '3 hours';
  d := local_now::date + ((g.weekday - extract(dow from local_now)::int + 7) % 7);
  if d = local_now::date and g.start_time < local_now::time then
    d := d + 7;
  end if;
  starts := (d + g.start_time) at time zone 'America/Sao_Paulo';
  insert into public.games (group_id, starts_at) values (p_group_id, starts)
  on conflict (group_id, starts_at) do nothing;
  select id into game_id from public.games where group_id = p_group_id and starts_at = starts;
  return game_id;
end;
$$;

-- Admin (Thiago): lista de grupos e marcação manual do "pago até".
create function public.admin_list_groups()
returns table (id uuid, name text, owner_email text, members_count bigint,
               paid_until date, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'sem acesso';
  end if;
  return query
    select g.id, g.name, u.email::text,
      (select count(*) from public.members m where m.group_id = g.id and m.active),
      g.paid_until, g.created_at
    from public.groups g
    join auth.users u on u.id = g.owner_id
    order by g.paid_until;
end;
$$;

create function public.admin_set_paid_until(p_group_id uuid, p_paid_until date)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'sem acesso';
  end if;
  update public.groups set paid_until = p_paid_until where id = p_group_id;
end;
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
