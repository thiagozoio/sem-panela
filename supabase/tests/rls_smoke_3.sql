-- Teste de fumaça da migração 20261019180000 (classificação). Rodar depois do rls_smoke.sql.
-- Linhas marcadas "fail" devem dar erro ou 0 linhas.
\set ON_ERROR_STOP 0
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000009';
select id as gid from public.groups limit 1 \gset
select public.admin_set_paid_until(:'gid', current_date + 30);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update public.groups set ranking = 'campeonato' where id = :'gid';
insert into public.championships (group_id, name, starts_on, ends_on) values (:'gid', '1º turno', '2026-01-01', '2026-06-30');
insert into public.championships (group_id, name, starts_on, ends_on) values (:'gid', 'ruim', '2026-07-01', '2026-06-30'); -- fail
update public.groups set ranking = 'anual' where id = :'gid'; -- fail
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select count(*) as visiveis from public.championships;
insert into public.championships (group_id, name, starts_on, ends_on) values (:'gid', 'hack', '2026-01-01', '2026-06-30'); -- fail
delete from public.championships; -- fail (0 linhas)
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select name, ranking from public.groups; select name from public.championships;
