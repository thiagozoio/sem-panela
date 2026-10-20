-- Sem Panela: desfaz o plano grátis (20261020120000_plano_gratis.sql).
-- Volta a regra anterior: com o "pago até" vencido há mais de 7 dias, o grupo
-- inteiro fica só leitura, inclusive lista de presença e sorteio.
-- Rode no SQL Editor do Supabase depois de 20261020120000_plano_gratis.sql.

-- is_premium volta a se chamar is_writable (as políticas seguem a função pelo id).
alter function public.is_premium(uuid) rename to is_writable;

drop trigger games_scores_premium on public.games;
drop function public.games_scores_premium();

-- ---------------------------------------------------------------------------
-- Políticas como estavam antes do plano grátis
-- ---------------------------------------------------------------------------

drop policy "grupo: organizador edita" on public.groups;
create policy "grupo: organizador edita" on public.groups
  for update to authenticated
  using (public.is_organizer(id) and public.is_writable(id))
  with check (public.is_organizer(id));

drop policy "jogador: organizador cria" on public.members;
create policy "jogador: organizador cria" on public.members
  for insert to authenticated
  with check (public.is_organizer(group_id) and public.is_writable(group_id));
drop policy "jogador: organizador edita" on public.members;
create policy "jogador: organizador edita" on public.members
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id))
  with check (public.is_organizer(group_id));
drop policy "jogador: organizador apaga" on public.members;
create policy "jogador: organizador apaga" on public.members
  for delete to authenticated
  using (public.is_organizer(group_id) and not is_organizer and public.is_writable(group_id));

drop policy "nível: organizador cria" on public.member_skills;
create policy "nível: organizador cria" on public.member_skills
  for insert to authenticated
  with check (public.is_organizer(group_id) and public.is_writable(group_id)
              and public.member_group(member_id) = group_id);
drop policy "nível: organizador edita" on public.member_skills;
create policy "nível: organizador edita" on public.member_skills
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id));

drop policy "telefone: organizador cria" on public.member_contacts;
create policy "telefone: organizador cria" on public.member_contacts
  for insert to authenticated
  with check (public.is_organizer(group_id) and public.is_writable(group_id)
              and public.member_group(member_id) = group_id);
drop policy "telefone: organizador edita" on public.member_contacts;
create policy "telefone: organizador edita" on public.member_contacts
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id));

drop policy "presença: confirmar" on public.attendances;
create policy "presença: confirmar" on public.attendances
  for insert to authenticated
  with check (
    public.member_group(member_id) = public.game_group(game_id)
    and public.is_writable(public.game_group(game_id))
    and (public.member_user(member_id) = auth.uid()
         or public.is_organizer(public.game_group(game_id)))
  );
drop policy "presença: mudar" on public.attendances;
create policy "presença: mudar" on public.attendances
  for update to authenticated
  using (
    public.is_writable(public.game_group(game_id))
    and (public.member_user(member_id) = auth.uid()
         or public.is_organizer(public.game_group(game_id)))
  );
drop policy "presença: apagar" on public.attendances;
create policy "presença: apagar" on public.attendances
  for delete to authenticated
  using (
    public.is_writable(public.game_group(game_id))
    and (public.member_user(member_id) = auth.uid()
         or public.is_organizer(public.game_group(game_id)))
  );

drop policy "jogo: organizador edita" on public.games;
create policy "jogo: organizador edita" on public.games
  for update to authenticated
  using (public.is_organizer(group_id) and public.is_writable(group_id))
  with check (public.is_organizer(group_id));

create or replace function public.set_organizer(p_member_id uuid, p_value boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
begin
  select * into m from public.members where id = p_member_id;
  if m.id is null or not public.is_organizer(m.group_id) or not public.is_writable(m.group_id) then
    raise exception 'sem acesso';
  end if;
  if p_value then
    if m.user_id is null or not m.active then
      raise exception 'o jogador precisa ter entrado pelo convite';
    end if;
  elsif not exists (
    select 1 from public.members o
    where o.group_id = m.group_id and o.id <> m.id and o.is_organizer and o.active
  ) then
    raise exception 'o grupo precisa de pelo menos um organizador';
  end if;
  update public.members set is_organizer = p_value where id = p_member_id;
end;
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
