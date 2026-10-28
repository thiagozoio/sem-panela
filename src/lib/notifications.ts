import { brazilDateTime } from "./matches";
import { formatGameDate, formatMoney, TZ } from "./format";
import { GRACE_DAYS } from "./subscription";
import type { ListEntry } from "./attendance";

/** O que vai para o service worker (public/sw.js). */
export type PushPayload = {
  title: string;
  body: string;
  /** Caminho aberto ao tocar na notificação. */
  url: string;
  /** Notificações com a mesma tag substituem a anterior no celular. */
  tag?: string;
};

function hourOf(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Dia da semana (0 = domingo) de uma data AAAA-MM-DD. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** Data seguinte (AAAA-MM-DD). */
export function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/**
 * Jogos do grupo que merecem lembrete hoje: o de hoje (se ainda não começou) e o de amanhã.
 * Mesmo horário que o banco calcula em ensure_next_game.
 */
export function gamesToRemind(
  group: { weekday: number; start_time: string },
  today: string,
  now = new Date(),
): { startsAt: string; when: "hoje" | "amanhã" }[] {
  const result: { startsAt: string; when: "hoje" | "amanhã" }[] = [];
  const time = group.start_time.slice(0, 5);
  for (const [day, when] of [[today, "hoje"], [nextDay(today), "amanhã"]] as const) {
    if (weekdayOf(day) !== group.weekday) continue;
    const startsAt = brazilDateTime(day, time);
    if (startsAt && new Date(startsAt).getTime() > now.getTime()) result.push({ startsAt, when });
  }
  return result;
}

/** Quem estava na lista de espera e agora está na lista principal. */
export function promotedMembers(before: ListEntry[], after: ListEntry[]): string[] {
  const was = new Set(before.map((e) => e.member.id));
  return after.filter((e) => !was.has(e.member.id)).map((e) => e.member.id);
}

/** Dias antes (positivos) ou depois (negativos) do vencimento em que o organizador é avisado. */
export const SUBSCRIPTION_REMINDER_DAYS = [3, 0, -1, -GRACE_DAYS];

/** Dia do mês em que mensalistas com a mensalidade em aberto recebem o lembrete. */
export const MONTHLY_FEE_REMINDER_DAY = 5;

const groupUrl = (groupId: string) => `/g/${groupId}`;

export const notify = {
  gameReminder(groupId: string, groupName: string, startsAt: string, when: "hoje" | "amanhã"): PushPayload {
    return {
      title: groupName,
      body: `Tem pelada ${when} às ${hourOf(startsAt)}. Você vai? Toque para confirmar na lista.`,
      url: groupUrl(groupId),
      tag: `jogo-${groupId}`,
    };
  },

  teamsDrawn(groupId: string, groupName: string, startsAt: string, teamName: string): PushPayload {
    return {
      title: `${groupName}: times sorteados`,
      body: `${formatGameDate(startsAt)}. Você está no ${teamName}.`,
      url: groupUrl(groupId),
      tag: `times-${groupId}`,
    };
  },

  pendingReminder(groupId: string, groupName: string, startsAt: string): PushPayload {
    return {
      title: groupName,
      body: `O organizador está fechando a lista de ${formatGameDate(startsAt)}. Você vai? Toque para responder.`,
      url: groupUrl(groupId),
      tag: `jogo-${groupId}`,
    };
  },

  promoted(groupId: string, groupName: string, startsAt: string): PushPayload {
    return {
      title: groupName,
      body: `Abriu vaga! Você saiu da lista de espera e está confirmado para ${formatGameDate(startsAt)}.`,
      url: groupUrl(groupId),
      tag: `jogo-${groupId}`,
    };
  },

  monthlyFee(groupId: string, groupName: string, monthName: string, amountCents: number, pixKey: string): PushPayload {
    const pix = pixKey ? ` Pix: ${pixKey}` : "";
    return {
      title: groupName,
      body: `Sua mensalidade de ${monthName.toLowerCase()} (${formatMoney(amountCents)}) ainda está em aberto.${pix}`,
      url: `${groupUrl(groupId)}/financeiro`,
      tag: `mensalidade-${groupId}`,
    };
  },

  subscription(groupId: string, groupName: string, daysLeft: number): PushPayload {
    const body =
      daysLeft > 0
        ? `A assinatura do Sem Panela vence em ${daysLeft} dia${daysLeft > 1 ? "s" : ""}. Renove para a pelada não parar.`
        : daysLeft === 0
          ? "A assinatura do Sem Panela vence hoje. Renove para a pelada não parar."
          : daysLeft === -GRACE_DAYS
            ? "Último dia: amanhã a pelada fica só leitura no app se a assinatura não for renovada."
            : `A assinatura do Sem Panela venceu. Em ${GRACE_DAYS + daysLeft + 1} dias a pelada fica só leitura no app.`;
    return { title: groupName, body, url: `${groupUrl(groupId)}/config`, tag: `assinatura-${groupId}` };
  },

  broadcast(groupId: string, groupName: string, text: string): PushPayload {
    return { title: groupName, body: text, url: groupUrl(groupId) };
  },
};
