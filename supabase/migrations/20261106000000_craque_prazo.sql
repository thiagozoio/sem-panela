-- Sem Panela: a votação do craque fecha 48 horas depois do início do jogo.
-- Rode no SQL Editor do Supabase depois de 20261105000000_craque_votacao.sql.

create or replace function public.mvp_vote_open(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.games g
    where g.id = gid and g.starts_at <= now() and now() < g.starts_at + interval '48 hours'
  );
$$;
revoke execute on function public.mvp_vote_open(uuid) from anon, public;
grant execute on function public.mvp_vote_open(uuid) to authenticated;

drop policy "craque: votar" on public.game_mvp_votes;
create policy "craque: votar" on public.game_mvp_votes
  for insert to authenticated
  with check (
    public.member_user(voter_id) = auth.uid()
    and public.mvp_vote_open(game_id)
    and public.is_writable(public.game_group(game_id))
    and public.played(game_id, voter_id)
    and public.played(game_id, voted_id)
  );

drop policy "craque: apagar o próprio voto" on public.game_mvp_votes;
create policy "craque: apagar o próprio voto" on public.game_mvp_votes
  for delete to authenticated
  using (
    public.member_user(voter_id) = auth.uid()
    and public.mvp_vote_open(game_id)
    and public.is_writable(public.game_group(game_id))
  );
