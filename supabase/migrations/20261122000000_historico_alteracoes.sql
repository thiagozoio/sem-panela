-- Sem Panela: histórico de alterações do grupo, com "Desfazer".
-- Rode no SQL Editor do Supabase depois de 20261120000000_cobranca_asaas.sql.
--
-- Cada mudança que um ORGANIZADOR faz nos dados do grupo (pagamentos, placar, gols, times,
-- presença, jogadores, gastos, campeonatos, amistosos, ajustes) fica gravada com o antes e
-- o depois. O organizador vê as últimas em Ajustes > Histórico e pode desfazer uma das 5
-- mais recentes. Mudanças dos jogadores (confirmar presença, votar, dar nota), do sistema
-- e da cobrança não entram.

create table if not exists public.change_log (
  id bigint generated always as identity primary key,
  -- Uma "alteração" (um clique no app) pode mexer em várias linhas; todas têm o mesmo change_id.
  change_id uuid not null,
  group_id uuid not null references public.groups (id) on delete cascade,
  actor_id uuid,
  request_key text,
  table_name text not null,
  op text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  row_key jsonb not null,
  old_row jsonb,
  new_row jsonb,
  created_at timestamptz not null default clock_timestamp(),
  undone_at timestamptz,
  undone_by uuid
);
grant select on public.change_log to authenticated;
grant select, insert, update, delete on public.change_log to service_role;
create index if not exists change_log_group_idx on public.change_log (group_id, id desc);
create index if not exists change_log_change_idx on public.change_log (change_id);

alter table public.change_log enable row level security;
drop policy if exists "historico: organizador le" on public.change_log;
create policy "historico: organizador le" on public.change_log
  for select to authenticated using (public.is_organizer(group_id));
-- Ninguém grava direto: só o gatilho abaixo e a função de desfazer.

-- ---------------------------------------------------------------------------
-- Gatilho: grava a mudança se quem fez é organizador do grupo.
-- Os argumentos do gatilho são as colunas da chave da tabela.
-- ---------------------------------------------------------------------------

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  gid uuid;
  cid uuid;
  hdr text;
  k text;
  rkey jsonb := '{}';
  changed boolean := false;
begin
  if uid is null or coalesce(current_setting('sem_panela.desfazendo', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    -- Só conta o que o organizador pode mudar pelo app (as colunas liberadas para edição).
    -- Assim "virar organizador", vincular conta, validade da assinatura etc. não entram.
    select bool_or(true) into changed
    from jsonb_object_keys(n) c
    where (o -> c) is distinct from (n -> c)
      and has_column_privilege('authenticated', format('public.%I', tg_table_name), c, 'UPDATE');
    if not coalesce(changed, false) then return null; end if;
  end if;

  if tg_table_name = 'groups' then
    gid := (r ->> 'id')::uuid;
  elsif r ? 'group_id' then
    gid := (r ->> 'group_id')::uuid;
  else
    select g.group_id into gid from public.games g where g.id = (r ->> 'game_id')::uuid;
  end if;
  if gid is null or not public.is_organizer(gid) then return null; end if;
  if not exists (select 1 from public.groups g where g.id = gid) then return null; end if;

  foreach k in array tg_argv loop
    rkey := rkey || jsonb_build_object(k, r -> k);
  end loop;

  -- Agrupa as linhas do mesmo clique: o app manda um código por ação no cabeçalho x-sp-acao;
  -- sem ele, junta o que o mesmo organizador mudou em até 2 segundos.
  begin
    hdr := nullif(current_setting('request.headers', true), '')::json ->> 'x-sp-acao';
  exception when others then
    hdr := null;
  end;
  if hdr is not null and hdr !~ '^[0-9a-f-]{36}$' then hdr := null; end if;

  select c.change_id into cid
  from public.change_log c
  where c.group_id = gid and c.actor_id = uid and c.undone_at is null
    and (
      (hdr is not null and c.request_key = hdr)
      or (hdr is null and c.request_key is null and c.created_at > clock_timestamp() - interval '2 seconds')
    )
  order by c.id desc
  limit 1;

  if cid is null then
    cid := gen_random_uuid();
    -- Limpeza: o histórico guarda 90 dias.
    delete from public.change_log c where c.group_id = gid and c.created_at < now() - interval '90 days';
  end if;

  insert into public.change_log (change_id, group_id, actor_id, request_key, table_name, op, row_key, old_row, new_row)
  values (cid, gid, uid, hdr, tg_table_name, tg_op, rkey, o, n);
  return null;
end;
$$;

-- Jogos: só a edição (times, placar). Jogos são criados pelo sistema.
drop trigger if exists log_change on public.games;
create trigger log_change after update on public.games
  for each row execute function public.log_change('id');
-- Ajustes do grupo: só a edição.
drop trigger if exists log_change on public.groups;
create trigger log_change after update on public.groups
  for each row execute function public.log_change('id');

drop trigger if exists log_change on public.members;
create trigger log_change after insert or update or delete on public.members
  for each row execute function public.log_change('id');
drop trigger if exists log_change on public.member_skills;
create trigger log_change after insert or update or delete on public.member_skills
  for each row execute function public.log_change('member_id');
drop trigger if exists log_change on public.member_contacts;
create trigger log_change after insert or update or delete on public.member_contacts
  for each row execute function public.log_change('member_id');
drop trigger if exists log_change on public.attendances;
create trigger log_change after insert or update or delete on public.attendances
  for each row execute function public.log_change('game_id', 'member_id');
drop trigger if exists log_change on public.payments;
create trigger log_change after insert or update or delete on public.payments
  for each row execute function public.log_change('id');
drop trigger if exists log_change on public.fixed_teams;
create trigger log_change after insert or update or delete on public.fixed_teams
  for each row execute function public.log_change('id');
drop trigger if exists log_change on public.expenses;
create trigger log_change after insert or update or delete on public.expenses
  for each row execute function public.log_change('id');
drop trigger if exists log_change on public.game_goals;
create trigger log_change after insert or update or delete on public.game_goals
  for each row execute function public.log_change('game_id', 'member_id');
drop trigger if exists log_change on public.championships;
create trigger log_change after insert or update or delete on public.championships
  for each row execute function public.log_change('id');
drop trigger if exists log_change on public.matches;
create trigger log_change after insert or update or delete on public.matches
  for each row execute function public.log_change('id');
drop trigger if exists log_change on public.member_apart;
create trigger log_change after insert or update or delete on public.member_apart
  for each row execute function public.log_change('id');

-- ---------------------------------------------------------------------------
-- Desfazer: volta as linhas da alteração para como estavam, na ordem inversa.
-- Só organizador do grupo, grupo com assinatura em dia, uma das 5 alterações mais recentes,
-- e nenhuma alteração mais nova (ainda valendo) mexeu nas mesmas linhas.
-- ---------------------------------------------------------------------------

create or replace function public.undo_change(p_change_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  gid uuid;
  e record;
  cond text;
  sets text;
  k text;
  cur jsonb;
  last_id bigint;
begin
  select c.group_id, max(c.id) into gid, last_id
  from public.change_log c where c.change_id = p_change_id
  group by c.group_id;
  if gid is null then raise exception 'Alteração não encontrada'; end if;
  if not public.is_organizer(gid) then raise exception 'Só o organizador desfaz alterações'; end if;
  if not public.is_writable(gid) then raise exception 'Grupo só leitura: assinatura vencida'; end if;
  if exists (select 1 from public.change_log c where c.change_id = p_change_id and c.undone_at is not null) then
    raise exception 'Essa alteração já foi desfeita';
  end if;
  if p_change_id not in (
    select x.change_id from (
      select c.change_id, max(c.id) as mid from public.change_log c
      where c.group_id = gid group by c.change_id order by mid desc limit 5
    ) x
  ) then
    raise exception 'Só dá para desfazer as 5 alterações mais recentes';
  end if;
  if exists (
    select 1 from public.change_log a
    join public.change_log b on b.table_name = a.table_name and b.row_key = a.row_key
    where a.change_id = p_change_id and b.group_id = gid and b.id > last_id
      and b.change_id <> p_change_id and b.undone_at is null
  ) then
    raise exception 'conflito: desfaça antes a alteração mais nova que mexeu na mesma coisa';
  end if;
  perform set_config('sem_panela.desfazendo', 'on', true);

  for e in select * from public.change_log c where c.change_id = p_change_id order by c.id desc loop
    if e.table_name not in ('games', 'groups', 'members', 'member_skills', 'member_contacts', 'attendances',
      'payments', 'fixed_teams', 'expenses', 'game_goals', 'championships', 'matches', 'member_apart') then
      raise exception 'Tabela inválida';
    end if;
    cond := '';
    for k in select jsonb_object_keys(e.row_key) loop
      cond := cond || case when cond = '' then '' else ' and ' end || format('t.%I = ($1 ->> %L)::uuid', k, k);
    end loop;

    -- Se alguém (um jogador, outro organizador) mexeu nessa linha depois, não sobrescreve.
    if e.op <> 'DELETE' then
      execute format('select to_jsonb(t) from public.%I t where %s', e.table_name, cond) into cur using e.row_key;
      if cur is not null and exists (
        select 1 from jsonb_object_keys(e.new_row) c
        where (e.op = 'INSERT' or (e.old_row -> c) is distinct from (e.new_row -> c))
          and has_column_privilege('authenticated', format('public.%I', e.table_name), c, 'UPDATE')
          and (cur -> c) is distinct from (e.new_row -> c)
      ) then
        raise exception 'conflito: isso mudou de novo depois dessa alteração';
      end if;
    end if;

    -- Jogador cadastrado que já tem histórico não é apagado (apagaria presenças e pagamentos).
    -- (O que foi criado junto nessa mesma alteração já foi desfeito antes, na ordem inversa.)
    if e.op = 'INSERT' and e.table_name = 'members' and (
      exists (select 1 from public.attendances t where t.member_id = (e.row_key ->> 'id')::uuid)
      or exists (select 1 from public.payments t where t.member_id = (e.row_key ->> 'id')::uuid)
      or exists (select 1 from public.game_goals t where t.member_id = (e.row_key ->> 'id')::uuid)
      or exists (select 1 from public.members t where t.id = (e.row_key ->> 'id')::uuid and t.user_id is not null)
    ) then
      raise exception 'jogador com historico: esse jogador já tem presença ou pagamento; use Tirar do grupo';
    end if;

    if e.op = 'INSERT' then
      execute format('delete from public.%I t where %s', e.table_name, cond) using e.row_key;
    elsif e.op = 'DELETE' then
      execute format(
        'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict do nothing',
        e.table_name, e.table_name
      ) using e.old_row;
    else
      -- Só as colunas que o organizador pode editar e que mudaram.
      select string_agg(format('%I = r.%I', c, c), ', ') into sets
      from jsonb_object_keys(e.new_row) c
      where (e.old_row -> c) is distinct from (e.new_row -> c)
        and has_column_privilege('authenticated', format('public.%I', e.table_name), c, 'UPDATE');
      if sets is not null then
        execute format(
          'update public.%I t set %s from jsonb_populate_record(null::public.%I, $2) r where %s',
          e.table_name, sets, e.table_name, cond
        ) using e.row_key, e.old_row;
      end if;
    end if;
  end loop;

  update public.change_log c set undone_at = now(), undone_by = auth.uid() where c.change_id = p_change_id;
  perform set_config('sem_panela.desfazendo', '', true);
end;
$$;

revoke execute on function public.log_change() from anon, public, authenticated;
revoke execute on function public.undo_change(uuid) from anon, public;
grant execute on function public.undo_change(uuid) to authenticated;
