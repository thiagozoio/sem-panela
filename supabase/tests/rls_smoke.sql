-- Teste de fumaça das permissões (RLS). Linhas marcadas "fail"/"must fail" devem dar erro ou 0 linhas.
\set ON_ERROR_STOP 0
insert into auth.users (id,email) values
 ('00000000-0000-0000-0000-000000000001','org@x.com'),
 ('00000000-0000-0000-0000-000000000002','joao@x.com'),
 ('00000000-0000-0000-0000-000000000003','intruso@x.com'),
 ('00000000-0000-0000-0000-000000000009','thiago@x.com');
update public.profiles set is_admin = true where id='00000000-0000-0000-0000-000000000009';
select count(*) as profiles from public.profiles;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.create_group('Pelada de Quinta','Arena X',4::smallint,'20:00',20::smallint,'Org') as gid \gset
select name, paid_until - current_date as trial_days from public.groups;
insert into public.members (group_id,name,kind) values (:'gid','Pedro','mensalista') returning id as pedro0 \gset
insert into public.member_skills (member_id, group_id, skill) values (:'pedro0', :'gid', 4);
select invite_code from public.groups \gset
select public.ensure_next_game(:'gid') as game \gset
select public.ensure_next_game(:'gid') = :'game' as same_game;
select starts_at at time zone 'America/Sao_Paulo' as local_start, extract(dow from starts_at at time zone 'America/Sao_Paulo') as dow from public.games;
-- org tries to change paid_until (must fail)
update public.groups set paid_until = '2030-01-01';
update public.groups set name = 'Pelada de Quinta FC';

-- joao joins, claims Pedro? no, joins new
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select group_name, already_member, unclaimed from public.invite_info(:'invite_code');
select count(*) as joao_sees_groups_before from public.groups;
select public.join_group(:'invite_code','João') is not null as joined;
select count(*) as joao_sees_members from public.members;
select id as joao_mid from public.members where user_id = auth.uid() \gset
select id as pedro_mid from public.members where name='Pedro' \gset
insert into public.attendances (game_id, member_id, going) values (:'game', :'joao_mid', true);
insert into public.attendances (game_id, member_id, going) values (:'game', :'pedro_mid', true); -- must fail
select count(*) as joao_sees_skills from public.member_skills;
insert into public.member_skills (member_id, group_id, skill) values (:'joao_mid', :'gid', 5); -- fail
insert into public.payments (group_id, member_id, kind, month, amount_cents) values (:'gid', :'joao_mid','mensal','2026-10-01',8000); -- fail
select public.admin_list_groups(); -- fail

-- intruder
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select count(*) as intruder_groups from public.groups;
select count(*) as intruder_members from public.members;
select public.ensure_next_game(:'gid'); -- fail
insert into public.attendances (game_id, member_id, going) values (:'game', :'joao_mid', false); -- fail

-- organizer marks payment and pedro attendance
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into public.attendances (game_id, member_id, going) values (:'game', :'pedro_mid', true);
insert into public.payments (group_id, member_id, kind, month, amount_cents) values (:'gid', :'joao_mid','mensal','2026-10-01',8000);
select count(*) as attendances from public.attendances;
select count(*) as org_sees_skills from public.member_skills;
update public.attendances set game_id = gen_random_uuid() where member_id = :'joao_mid'; -- fail (column)
update public.games set teams = '[]'::jsonb where id = :'game';

-- admin
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000009';
select * from public.admin_list_groups();
select public.admin_set_paid_until(:'gid', current_date - 10);

-- now read-only
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
update public.attendances set going = false where member_id = :'joao_mid'; -- 0 rows
select going from public.attendances where member_id = :'joao_mid';
reset role;
