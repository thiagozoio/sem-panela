-- Sem Panela: saldo inicial do caixa, placar, gols e notas depois do jogo.
-- Rode no SQL Editor do Supabase depois do 20261018000000_admins_times_gastos.sql.

-- ---------------------------------------------------------------------------
-- Caixa: saldo com que a pelada começou a usar o app
-- ---------------------------------------------------------------------------

alter table public.groups add column cash_start_cents integer not null default 0;
grant update (cash_start_cents) on public.groups to authenticated;

-- ---------------------------------------------------------------------------
-- Placar (um número por time, na ordem de games.teams) e gols por jogador
-- ---------------------------------------------------------------------------

alter table public.games add column scores smallint[];
grant update (scores) on public.games to authenticated;

create table public.game_goals (
  game_id uuid not null references public.games (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  goals smallint not null check (goals between 1 and 50),
  primary key (game_id, member_id)
);

alter table public.game_goals enable row level security;
create policy "gol: membros leem" on public.game_goals
  for select to authenticated using (public.is_member(public.game_group(game_id)));
create policy "gol: organizador lança" on public.game_goals
  for insert to authenticated
  with check (
    public.is_organizer(public.game_group(game_id)) and public.is_writable(public.game_group(game_id))
    and public.member_group(member_id) = public.game_group(game_id)
  );
create policy "gol: organizador muda" on public.game_goals
  for update to authenticated
  using (public.is_organizer(public.game_group(game_id)) and public.is_writable(public.game_group(game_id)));
create policy "gol: organizador apaga" on public.game_goals
  for delete to authenticated
  using (public.is_organizer(public.game_group(game_id)) and public.is_writable(public.game_group(game_id)));
revoke update on public.game_goals from authenticated;
grant update (goals) on public.game_goals to authenticated;

-- ---------------------------------------------------------------------------
-- Notas: quem jogou dá nota de 1 a 10 para quem jogou, depois do início do jogo.
-- Cada um só vê as próprias notas; a média sai por game_rating_summary.
-- ---------------------------------------------------------------------------

create function public.played(gid uuid, mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.attendances a
    where a.game_id = gid and a.member_id = mid and a.going
  );
$$;

create function public.game_started(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.games g where g.id = gid and g.starts_at <= now());
$$;

create table public.game_ratings (
  game_id uuid not null references public.games (id) on delete cascade,
  rater_id uuid not null references public.members (id) on delete cascade,
  rated_id uuid not null references public.members (id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  created_at timestamptz not null default now(),
  primary key (game_id, rater_id, rated_id),
  check (rater_id <> rated_id)
);

alter table public.game_ratings enable row level security;
create policy "nota: ler as próprias" on public.game_ratings
  for select to authenticated using (public.member_user(rater_id) = auth.uid());
create policy "nota: dar" on public.game_ratings
  for insert to authenticated
  with check (
    public.member_user(rater_id) = auth.uid()
    and public.game_started(game_id)
    and public.is_writable(public.game_group(game_id))
    and public.played(game_id, rater_id)
    and public.played(game_id, rated_id)
  );
create policy "nota: mudar" on public.game_ratings
  for update to authenticated
  using (public.member_user(rater_id) = auth.uid() and public.is_writable(public.game_group(game_id)));
create policy "nota: apagar" on public.game_ratings
  for delete to authenticated
  using (public.member_user(rater_id) = auth.uid() and public.is_writable(public.game_group(game_id)));
revoke update on public.game_ratings from authenticated;
grant update (rating) on public.game_ratings to authenticated;

create function public.game_rating_summary(p_game_id uuid)
returns table (member_id uuid, average numeric, votes integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_member(public.game_group(p_game_id)) then
    raise exception 'sem acesso';
  end if;
  return query
    select r.rated_id, round(avg(r.rating), 1), count(*)::integer
    from public.game_ratings r
    where r.game_id = p_game_id
    group by r.rated_id;
end;
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
