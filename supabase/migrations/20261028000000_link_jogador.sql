-- Link pessoal de acesso do jogador: o organizador manda pelo WhatsApp um link só
-- daquele jogador, que entra sem e-mail nem código e fica logado no celular.
-- Rode no SQL Editor do Supabase.

-- Guardamos só o hash do token; o link em si só existe na mensagem do WhatsApp.
create table public.member_links (
  token_hash text primary key,
  member_id uuid not null references public.members (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz
);
grant select, insert, update, delete on public.member_links to authenticated, service_role;
create index member_links_member_idx on public.member_links (member_id);

-- Sem políticas: ninguém lê ou escreve direto, só pelas funções abaixo.
alter table public.member_links enable row level security;

-- O link só serve para jogador comum: conta criada pelo próprio link (app_metadata.via_link),
-- que não é admin, não é dona e não organiza nenhum grupo. Conta com e-mail continua com e-mail.
create function public.link_login_allowed(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from auth.users u
      where u.id = uid and coalesce((u.raw_app_meta_data ->> 'via_link')::boolean, false)
    )
    and not exists (select 1 from public.profiles p where p.id = uid and p.is_admin)
    and not exists (select 1 from public.groups g where g.owner_id = uid)
    and not exists (select 1 from public.members m where m.user_id = uid and m.is_organizer);
$$;

-- Organizador gera um link novo para o jogador. O anterior deixa de valer.
create function public.create_member_link(p_member_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
  tok text;
begin
  select * into m from public.members where id = p_member_id;
  if m.id is null or not public.is_organizer(m.group_id) or not public.is_writable(m.group_id) then
    raise exception 'sem acesso';
  end if;
  if not m.active then
    raise exception 'jogador fora do grupo';
  end if;
  if m.is_organizer or (m.user_id is not null and not public.link_login_allowed(m.user_id)) then
    raise exception 'jogador entra com e-mail';
  end if;
  delete from public.member_links where member_id = m.id;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.member_links (token_hash, member_id, group_id, created_by)
  values (encode(sha256(convert_to(tok, 'UTF8')), 'hex'), m.id, m.group_id, auth.uid());
  return tok;
end;
$$;

-- Usado só pelo servidor (chave secreta). Confere o link e, com p_consume, marca como usado.
-- Depois do primeiro uso ele ainda vale por 1 hora (ex.: abriu no Safari e depois no app instalado).
create function public.redeem_member_link(p_token text, p_consume boolean)
returns table (member_id uuid, user_id uuid, member_name text, group_id uuid, group_name text)
language plpgsql security definer set search_path = '' as $$
declare
  h text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'sem acesso';
  end if;
  return query
    select m.id, m.user_id, m.name, g.id, g.name
    from public.member_links l
    join public.members m on m.id = l.member_id
    join public.groups g on g.id = l.group_id
    where l.token_hash = h
      and l.expires_at > now()
      and (l.used_at is null or l.used_at > now() - interval '1 hour')
      and m.active and not m.is_organizer
      and (m.user_id is null or public.link_login_allowed(m.user_id));
  if p_consume and found then
    update public.member_links set used_at = coalesce(used_at, now()) where token_hash = h;
  end if;
end;
$$;

-- Usado só pelo servidor: liga a conta recém-criada pelo link ao cadastro do jogador
-- e já põe o nome no perfil. Devolve a conta que ficou ligada.
create function public.link_member_account(p_member_id uuid, p_user_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'sem acesso';
  end if;
  update public.members set user_id = p_user_id where id = p_member_id and user_id is null;
  select * into m from public.members where id = p_member_id;
  update public.profiles set name = m.name where id = m.user_id and name = '';
  return m.user_id;
end;
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.redeem_member_link(text, boolean) from authenticated;
revoke execute on function public.link_member_account(uuid, uuid) from authenticated;
grant execute on function public.redeem_member_link(text, boolean) to service_role;
grant execute on function public.link_member_account(uuid, uuid) to service_role;
