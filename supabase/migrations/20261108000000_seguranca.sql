-- Sem Panela: ajustes de segurança antes de abrir para o público.
-- Rode no SQL Editor do Supabase depois de 20261106180000_nao_jogam_juntos.sql.
-- Não muda nada do que o app faz hoje; só fecha caminhos que dava para usar chamando a API direto.

-- ---------------------------------------------------------------------------
-- 1. Cadastro de jogador: o organizador não escolhe a conta (user_id) nem cria organizador.
-- Antes, quem criasse um grupo próprio podia cadastrar nele um jogador com a conta de outra
-- pessoa (o id aparece para quem é do mesmo grupo), gerar o link pessoal e entrar como ela.
-- A conta só é ligada pelo convite (join_group) ou pelo link (link_member_account), e
-- organizador só se vira por set_organizer.
-- ---------------------------------------------------------------------------

revoke insert on public.members from authenticated;
grant insert (group_id, name, position, kind, active, exempt, guest) on public.members to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Lista de presença: a hora da confirmação é sempre a do servidor.
-- Antes dava para mandar uma data antiga e furar a fila dos mensalistas.
-- ---------------------------------------------------------------------------

create or replace function public.attendance_confirmed_now() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Só para quem usa o app (no SQL Editor e na chave secreta continua livre).
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' or new.confirmed_at is distinct from old.confirmed_at then
      new.confirmed_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists attendances_confirmed_now on public.attendances;
create trigger attendances_confirmed_now
  before insert or update on public.attendances
  for each row execute function public.attendance_confirmed_now();

-- ---------------------------------------------------------------------------
-- 3. Apagar o grupo: só a dona da conta (o app não tem esse botão; antes qualquer
-- organizador promovido podia apagar tudo pela API, e o plano grátis não tem backup).
-- ---------------------------------------------------------------------------

drop policy if exists "grupo: organizador apaga" on public.groups;
create policy "grupo: dono apaga" on public.groups
  for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Função interna do link do jogador: só as outras funções usam.
-- ---------------------------------------------------------------------------

revoke execute on function public.attendance_confirmed_now() from anon, public, authenticated;
revoke execute on function public.link_login_allowed(uuid) from anon, public, authenticated;
