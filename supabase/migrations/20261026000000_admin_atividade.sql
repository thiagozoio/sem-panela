-- Sem Panela: o que cada grupo fez no app nos últimos 30 dias (presenças, sorteios, placares,
-- pagamentos, notas), para o /admin. Rode no SQL Editor depois de 20261021000000_admin_uso.sql.

drop function if exists public.admin_group_activity();

create function public.admin_group_activity()
returns table (group_id uuid, from_admin boolean, games_count bigint, last_game timestamptz,
               games_30d bigint, attendances_30d bigint, players_confirming_30d bigint,
               draws_30d bigint, results_30d bigint, payments_30d bigint, ratings_30d bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'sem acesso';
  end if;
  return query
    with recent as (
      -- peladas que aconteceram (ou vão acontecer) dentro da janela de 30 dias
      select ga.* from public.games ga
      where ga.starts_at between now() - interval '30 days' and now() + interval '7 days'
    )
    select
      g.id,
      p.is_admin,
      (select count(*) from public.games ga where ga.group_id = g.id),
      (select max(ga.starts_at) from public.games ga where ga.group_id = g.id and ga.starts_at <= now()),
      (select count(*) from recent r where r.group_id = g.id),
      (select count(*) from public.attendances a join recent r on r.id = a.game_id
        where r.group_id = g.id and a.going),
      (select count(distinct a.member_id) from public.attendances a join recent r on r.id = a.game_id
        where r.group_id = g.id and a.going),
      (select count(*) from recent r where r.group_id = g.id and r.teams is not null),
      (select count(*) from recent r where r.group_id = g.id and r.scores is not null),
      (select count(*) from public.payments pa
        where pa.group_id = g.id and pa.paid_at > now() - interval '30 days'),
      (select count(*) from public.game_ratings gr join recent r on r.id = gr.game_id
        where r.group_id = g.id)
    from public.groups g
    join public.profiles p on p.id = g.owner_id;
end;
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
