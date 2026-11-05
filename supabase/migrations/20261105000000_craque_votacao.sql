-- Sem Panela: votação do craque do jogo. Quem jogou escolhe um craque (não pode
-- votar em si mesmo); todo mundo do grupo vê quantos votos cada um teve.
-- Rode no SQL Editor do Supabase depois de 20261104000000_final_campeonato.sql.

create table public.game_mvp_votes (
  game_id uuid not null references public.games (id) on delete cascade,
  voter_id uuid not null references public.members (id) on delete cascade,
  voted_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, voter_id),
  check (voter_id <> voted_id)
);
grant select, insert, update, delete on public.game_mvp_votes to authenticated, service_role;

alter table public.game_mvp_votes enable row level security;
create policy "craque: ler o próprio voto" on public.game_mvp_votes
  for select to authenticated using (public.member_user(voter_id) = auth.uid());
create policy "craque: votar" on public.game_mvp_votes
  for insert to authenticated
  with check (
    public.member_user(voter_id) = auth.uid()
    and public.game_started(game_id)
    and public.is_writable(public.game_group(game_id))
    and public.played(game_id, voter_id)
    and public.played(game_id, voted_id)
  );
create policy "craque: apagar o próprio voto" on public.game_mvp_votes
  for delete to authenticated
  using (public.member_user(voter_id) = auth.uid() and public.is_writable(public.game_group(game_id)));
revoke update on public.game_mvp_votes from authenticated;

create function public.game_mvp_summary(p_game_id uuid)
returns table (member_id uuid, votes integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_member(public.game_group(p_game_id)) then
    raise exception 'sem acesso';
  end if;
  return query
    select v.voted_id, count(*)::integer
    from public.game_mvp_votes v
    where v.game_id = p_game_id
    group by v.voted_id;
end;
$$;

revoke execute on function public.game_mvp_summary(uuid) from anon, public;
grant execute on function public.game_mvp_summary(uuid) to authenticated;
