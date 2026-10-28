-- Sem Panela: notificações push no celular (Web Push).
-- Cada aparelho que ativa os avisos vira uma linha aqui. O envio é feito pelo servidor do app
-- com a chave secreta do Supabase; o usuário só vê e apaga as próprias inscrições.
-- Rode no SQL Editor depois de 20261026000000_admin_atividade.sql (independe de 20261028000000_link_jogador.sql).

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push: ler as próprias" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push: apagar as próprias" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());
-- Gravação só pela função abaixo (o mesmo aparelho pode trocar de conta).
revoke insert, update on public.push_subscriptions from authenticated;

create function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default ''
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
     or char_length(p_p256dh) > 200 or char_length(p_auth) > 100 then
    raise exception 'inscrição inválida';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
