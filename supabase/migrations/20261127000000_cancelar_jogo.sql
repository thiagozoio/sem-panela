-- Cancelar o jogo do dia (chuva, quadra fechada, pouca gente).
-- O jogo continua no banco (presenças, times) para dar para desfazer; enquanto estiver
-- cancelado ninguém confirma presença, não entra na tabela nem cobra avulso.

alter table public.games
  add column if not exists canceled_at timestamptz,
  add column if not exists cancel_reason text check (char_length(cancel_reason) <= 120);

-- O organizador edita (a política "jogo: organizador edita" já limita a ele).
-- Com a permissão de coluna, o "desfazer" do histórico também volta o cancelamento.
grant update (canceled_at, cancel_reason) on public.games to authenticated;

-- Jogo cancelado não aceita presença nova nem troca de resposta (nem direto pelo banco).
create or replace function public.attendance_open() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('sem_panela.desfazendo', true) = 'on' then
    return new;
  end if;
  if exists (select 1 from public.games g where g.id = new.game_id and g.canceled_at is not null) then
    raise exception 'jogo cancelado';
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_open on public.attendances;
create trigger attendance_open before insert or update on public.attendances
  for each row execute function public.attendance_open();
