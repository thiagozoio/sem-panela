import { splitList } from "@/lib/attendance";
import { isBillingMonth, monthLabel, monthStart, todayInBrazil } from "@/lib/format";
import {
  gamesToRemind,
  MONTHLY_FEE_REMINDER_DAY,
  notify,
  SUBSCRIPTION_REMINDER_DAYS,
} from "@/lib/notifications";
import { pushEnabled, sendPush } from "@/lib/push";
import { subscriptionState } from "@/lib/subscription";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";
import type { Attendance, Group, Member } from "@/lib/types";

// Rotina diária da Vercel (vercel.json, 10h de Brasília): lembrete de pelada hoje/amanhã para
// quem não respondeu, mensalidade em aberto no dia 5 e aviso de assinatura vencendo ao organizador.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("não autorizado", { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin || !pushEnabled()) return Response.json({ ok: false, motivo: "avisos desligados (faltam variáveis)" });

  const today = todayInBrazil();
  const { data: groups } = await admin.from("groups").select("*").returns<Group[]>();
  const counts = { jogos: 0, mensalidades: 0, assinaturas: 0 };

  for (const group of groups ?? []) {
    try {
      const state = subscriptionState(group.paid_until, today);
      if (SUBSCRIPTION_REMINDER_DAYS.includes(state.daysLeft)) {
        counts.assinaturas += await subscriptionReminder(admin, group, state.daysLeft);
      }
      if (state.status === "read_only") continue;
      const { data } = await admin.from("members").select("*").eq("group_id", group.id).eq("active", true).returns<Member[]>();
      const members = data ?? [];
      counts.jogos += await gameReminders(admin, group, members, today);
      if (Number(today.slice(8, 10)) === MONTHLY_FEE_REMINDER_DAY && group.monthly_fee_cents > 0) {
        counts.mensalidades += await monthlyFeeReminder(admin, group, members, today);
      }
    } catch (err) {
      console.error("aviso diário falhou", group.id, err);
    }
  }
  return Response.json({ ok: true, ...counts });
}

async function gameReminders(admin: AdminClient, group: Group, members: Member[], today: string) {
  let sent = 0;
  for (const { startsAt, when } of gamesToRemind(group, today)) {
    // Mesmo jogo que a tela abre (ensure_next_game): cria se ninguém abriu a lista ainda.
    await admin.from("games").upsert({ group_id: group.id, starts_at: startsAt }, { onConflict: "group_id,starts_at", ignoreDuplicates: true });
    const { data: game } = await admin.from("games").select("id").eq("group_id", group.id).eq("starts_at", startsAt).maybeSingle();
    if (!game) continue;
    const { data: attendances } = await admin.from("attendances").select("*").eq("game_id", game.id).returns<Attendance[]>();
    const rows = attendances ?? [];
    // Lista cheia no dia do jogo: não adianta chamar mais gente.
    const { confirmed } = splitList(rows, members, group.max_players, startsAt, group.priority_hours);
    if (when === "hoje" && confirmed.length >= group.max_players) continue;
    const answered = new Set(rows.map((a) => a.member_id));
    const userIds = members.filter((m) => m.user_id && !answered.has(m.id)).map((m) => m.user_id!);
    sent += await sendPush(userIds, notify.gameReminder(group.id, group.name, startsAt, when), admin);
  }
  return sent;
}

async function monthlyFeeReminder(admin: AdminClient, group: Group, members: Member[], today: string) {
  const month = monthStart(today);
  if (!isBillingMonth(group.billing_start, month)) return 0;
  const { data: paid } = await admin.from("payments").select("member_id").eq("group_id", group.id).eq("kind", "mensal").eq("month", month);
  const paidIds = new Set((paid ?? []).map((p) => p.member_id));
  const userIds = members
    .filter((m) => m.kind === "mensalista" && m.user_id && !paidIds.has(m.id))
    .map((m) => m.user_id!);
  return sendPush(userIds, notify.monthlyFee(group.id, group.name, monthLabel(month), group.monthly_fee_cents, group.pix_key), admin);
}

async function subscriptionReminder(admin: AdminClient, group: Group, daysLeft: number) {
  const { data } = await admin.from("members").select("user_id").eq("group_id", group.id).eq("active", true).eq("is_organizer", true);
  const userIds = (data ?? []).map((m) => m.user_id as string | null).filter((id): id is string => !!id);
  return sendPush(userIds, notify.subscription(group.id, group.name, daysLeft), admin);
}
