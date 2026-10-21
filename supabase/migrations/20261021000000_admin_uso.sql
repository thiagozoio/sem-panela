-- Sem Panela: números de uso na página /admin (contas, grupos, peladas, presenças).
-- Rode no SQL Editor do Supabase depois de 20261020180000_reverter_plano_gratis.sql.
-- Grupos de admins ficam de fora das contagens, para mostrar só os clientes.

create function public.admin_usage()
returns table (users_total bigint, users_7d bigint, users_new_30d bigint,
               groups_total bigint, groups_active_30d bigint, members_total bigint,
               members_with_account bigint, games_total bigint, attendances_30d bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'sem acesso';
  end if;
  return query
    with g as (
      select g.id from public.groups g
      join public.profiles p on p.id = g.owner_id
      where not p.is_admin
    )
    select
      (select count(*) from auth.users),
      (select count(*) from auth.users u where u.last_sign_in_at > now() - interval '7 days'),
      (select count(*) from auth.users u where u.created_at > now() - interval '30 days'),
      (select count(*) from g),
      (select count(distinct ga.group_id) from public.games ga
        where ga.group_id in (select id from g) and ga.created_at > now() - interval '30 days'),
      (select count(*) from public.members m where m.group_id in (select id from g) and m.active),
      (select count(*) from public.members m
        where m.group_id in (select id from g) and m.active and m.user_id is not null),
      (select count(*) from public.games ga where ga.group_id in (select id from g)),
      (select count(*) from public.attendances a join public.games ga on ga.id = a.game_id
        where ga.group_id in (select id from g) and a.confirmed_at > now() - interval '30 days');
end;
$$;

-- Última pelada e total de peladas de cada grupo, para os cards do /admin.
create function public.admin_group_activity()
returns table (group_id uuid, games_count bigint, last_game timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'sem acesso';
  end if;
  return query
    select ga.group_id, count(*), max(ga.starts_at)
    from public.games ga
    group by ga.group_id;
end;
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
