-- Teste de fumaça da migração 20261018 (rodar depois do rls_smoke.sql, no mesmo banco).
-- Linhas marcadas "fail" devem dar erro ou 0 linhas.
\set ON_ERROR_STOP 0
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000009';
select id as gid from public.groups limit 1 \gset
select public.admin_set_paid_until(:'gid', current_date + 30);

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select id as org_mid from public.members where user_id = auth.uid() \gset
select id as joao_mid from public.members where name = 'João' \gset
select id as pedro_mid from public.members where name = 'Pedro' \gset
select public.set_organizer(:'org_mid', false); -- fail: último organizador
select public.set_organizer(:'pedro_mid', true); -- fail: sem conta
select public.set_organizer(:'joao_mid', true);
select name, is_organizer from public.members order by name;

-- João (agora organizador) tira o organizador original
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select public.set_organizer(:'org_mid', false);
insert into public.fixed_teams (group_id, month, name, member_ids)
  values (:'gid', '2026-10-01', 'Azul', array[:'joao_mid'::uuid]) returning id as team \gset
update public.fixed_teams set name = 'Azulão' where id = :'team';
update public.fixed_teams set group_id = gen_random_uuid() where id = :'team'; -- fail (coluna)
insert into public.expenses (group_id, month, description, amount_cents) values (:'gid', '2026-10-01', 'Quadra', 40000);
insert into public.expenses (group_id, month, description, amount_cents) values (:'gid', '2026-10-15', 'Bola', 100); -- fail (dia 1)
insert into public.payments (group_id, member_id, kind, month, amount_cents, note)
  values (:'gid', :'joao_mid', 'mensal', '2026-11-01', 9000, 'multa atraso');

-- o organizador original virou jogador comum
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select count(*) as ex_org_sees_teams from public.fixed_teams;
select count(*) as ex_org_sees_expenses from public.expenses; -- 0
insert into public.fixed_teams (group_id, month, name) values (:'gid', '2026-10-01', 'Hack'); -- fail
select public.set_organizer(:'org_mid', true); -- fail

-- intruso
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select count(*) as intruder_teams from public.fixed_teams; -- 0
reset role;
select name, is_organizer from public.members order by name;
select name, member_ids from public.fixed_teams;
select note, amount_cents from public.payments where note <> '';
