import { formatDay, formatMoney, monthLabel, TZ } from "./format";

/** Uma linha do histórico (tabela change_log). */
export type ChangeEntry = {
  id: number;
  change_id: string;
  actor_id: string | null;
  table_name: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  row_key: Record<string, string>;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
  created_at: string;
  undone_at: string | null;
  undone_by: string | null;
};

/** Uma alteração = tudo que um clique do organizador mudou. */
export type Change = {
  id: string;
  actorId: string | null;
  at: string;
  undoneAt: string | null;
  undoneBy: string | null;
  entries: ChangeEntry[];
};

/** Quantas alterações mais recentes dá para desfazer (o banco confere o mesmo número). */
export const UNDO_LIMIT = 5;

/** Junta as linhas por alteração, da mais nova para a mais antiga. */
export function groupChanges(rows: ChangeEntry[]): Change[] {
  const byId = new Map<string, Change>();
  for (const r of [...rows].sort((a, b) => a.id - b.id)) {
    const c = byId.get(r.change_id);
    if (c) {
      c.entries.push(r);
      c.at = r.created_at;
      c.undoneAt ??= r.undone_at;
      c.undoneBy ??= r.undone_by;
    } else {
      byId.set(r.change_id, {
        id: r.change_id,
        actorId: r.actor_id,
        at: r.created_at,
        undoneAt: r.undone_at,
        undoneBy: r.undone_by,
        entries: [r],
      });
    }
  }
  const last = (c: Change) => c.entries[c.entries.length - 1].id;
  return [...byId.values()].sort((a, b) => last(b) - last(a));
}

export type HistoryNames = {
  /** id do jogador -> nome */
  members: Map<string, string>;
  /** id do jogo -> data (ISO) */
  games: Map<string, string>;
};

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

function gameDay(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(new Date(iso));
  return ` de ${d}`;
}

function changed(e: ChangeEntry): string[] {
  if (e.op !== "UPDATE" || !e.old_row || !e.new_row) return [];
  return Object.keys(e.new_row).filter((k) => JSON.stringify(e.old_row![k]) !== JSON.stringify(e.new_row![k]));
}

const GROUP_FIELDS: Record<string, string> = {
  name: "nome",
  location: "local",
  weekday: "dia",
  start_time: "horário",
  max_players: "máximo de jogadores",
  players_per_team: "jogadores por time",
  priority_hours: "prioridade dos mensalistas",
  monthly_fee_cents: "mensalidade",
  single_fee_cents: "valor do avulso",
  pix_key: "chave Pix",
  cash_start_cents: "saldo inicial do caixa",
  sport: "modalidade",
  ranking: "classificação",
  matches: "amistosos",
  billing_start: "início da cobrança",
};

const MEMBER_FIELDS: Record<string, string> = {
  name: "nome",
  position: "posição",
  kind: "tipo",
  exempt: "isento",
  guest: "convidado",
};

/** Frase de uma linha do histórico, ou null quando ela não diz nada sozinha. */
export function describeEntry(e: ChangeEntry, names: HistoryNames): string | null {
  const row = (e.new_row ?? e.old_row ?? {}) as Record<string, unknown>;
  const member = names.members.get(s(row.member_id)) ?? s(row.name);
  const game = gameDay(names.games.get(s(row.game_id)));
  const cols = changed(e);

  switch (e.table_name) {
    case "payments": {
      const what = row.kind === "mensal" && row.month ? ` (${monthLabel(s(row.month)).toLowerCase()})` : game ? ` (jogo${game})` : "";
      if (e.op === "INSERT") return `Marcou pagamento de ${member}${what}`;
      if (e.op === "DELETE") return `Desmarcou pagamento de ${member}${what}`;
      return `Alterou pagamento de ${member}${what}`;
    }
    case "games": {
      const day = gameDay(s(row.starts_at));
      const parts: string[] = [];
      if (cols.includes("scores")) {
        const sc = e.new_row?.scores;
        parts.push(Array.isArray(sc) && sc.length ? `Placar do jogo${day}: ${sc.join(" x ")}` : `Apagou o placar do jogo${day}`);
      }
      if (cols.includes("canceled_at")) {
        parts.push(e.new_row?.canceled_at ? `Cancelou o jogo${day}` : `Desfez o cancelamento do jogo${day}`);
      }
      if (cols.includes("teams")) {
        parts.push(e.new_row?.teams ? `Mudou os times do jogo${day}` : `Desfez os times do jogo${day}`);
      }
      return parts.length ? parts.join(" · ") : `Alterou o jogo${day}`;
    }
    case "game_goals": {
      const goals = Number(row.goals ?? 0);
      const own = Number(row.own_goals ?? 0);
      if (e.op === "DELETE") return `Tirou os gols de ${member}${game}`;
      const g = [goals ? `${goals} gol${goals > 1 ? "s" : ""}` : "", own ? `${own} contra` : ""].filter(Boolean).join(" e ");
      return `Gols de ${member}${game}: ${g || "nenhum"}`;
    }
    case "attendances": {
      if (e.op === "DELETE") return `Tirou a resposta de ${member} no jogo${game}`;
      if (e.op === "UPDATE" && cols.length === 1 && cols[0] === "team") return `Mudou o time de ${member} no jogo${game}`;
      return row.going ? `Marcou ${member} como "vai" no jogo${game}` : `Marcou ${member} como "não vai" no jogo${game}`;
    }
    case "members": {
      const name = s(row.name);
      if (e.op === "INSERT") return row.guest ? `Adicionou o convidado ${name}` : `Cadastrou ${name}`;
      if (e.op === "DELETE") return `Apagou ${name}`;
      if (cols.includes("active")) return row.active ? `Voltou ${name} para o grupo` : `Tirou ${name} do grupo`;
      const what = cols.map((c) => MEMBER_FIELDS[c]).filter(Boolean);
      return `Editou ${name}${what.length ? ` (${what.join(", ")})` : ""}`;
    }
    case "member_skills":
      return `Mudou o nível de ${member}`;
    case "member_contacts":
      return `Mudou o telefone de ${member}`;
    case "fixed_teams": {
      const month = row.month ? ` de ${monthLabel(s(row.month)).toLowerCase()}` : "";
      if (e.op === "INSERT") return `Criou o ${s(row.name)}${month}`;
      if (e.op === "DELETE") return `Apagou o ${s(row.name)}${month}`;
      if (cols.includes("name")) return `Renomeou ${s(e.old_row?.name)} para ${s(row.name)}`;
      return `Mudou os jogadores do ${s(row.name)}${month}`;
    }
    case "expenses": {
      const what = `${s(row.description)} (${formatMoney(Number(row.amount_cents ?? 0))})`;
      if (e.op === "INSERT") return `Lançou o gasto ${what}`;
      if (e.op === "DELETE") return `Apagou o gasto ${what}`;
      return `Alterou o gasto ${what}`;
    }
    case "championships": {
      if (e.op === "INSERT") return `Criou o campeonato ${s(row.name)}`;
      if (e.op === "DELETE") return `Apagou o campeonato ${s(row.name)}`;
      return `Alterou o campeonato ${s(row.name)}`;
    }
    case "matches": {
      const vs = `amistoso contra ${s(row.opponent) || "adversário"}`;
      if (e.op === "INSERT") return `Marcou ${vs}`;
      if (e.op === "DELETE") return `Apagou ${vs}`;
      if (cols.includes("our_score") || cols.includes("their_score")) {
        return `Placar do ${vs}: ${s(row.our_score)} x ${s(row.their_score)}`;
      }
      return `Alterou ${vs}`;
    }
    case "member_apart": {
      const a = names.members.get(s(row.member_a)) ?? "?";
      const b = names.members.get(s(row.member_b)) ?? "?";
      return e.op === "DELETE" ? `Liberou ${a} e ${b} para jogarem juntos` : `${a} e ${b} não jogam juntos`;
    }
    case "groups": {
      if (cols.length === 1 && cols[0] === "cash_start_cents") {
        return `Saldo inicial do caixa: ${formatMoney(Number(row.cash_start_cents ?? 0))}`;
      }
      if (cols.length === 1 && cols[0] === "billing_start") {
        return row.billing_start ? `Início da cobrança: ${formatDay(s(row.billing_start)).slice(3)}` : "Tirou o início da cobrança";
      }
      const what = cols.map((c) => GROUP_FIELDS[c]).filter(Boolean);
      return `Mudou os ajustes da pelada${what.length ? ` (${what.join(", ")})` : ""}`;
    }
    default:
      return null;
  }
}

/** Linhas para mostrar de uma alteração: sem repetir, as de gols do placar juntas. */
export function describeChange(change: Change, names: HistoryNames): string[] {
  const lines: string[] = [];
  for (const e of change.entries) {
    // Ao anotar o placar o app apaga e regrava os gols; mostra só o resultado final.
    if (e.table_name === "game_goals" && e.op === "DELETE") {
      const key = `${s(e.row_key.game_id)}:${s(e.row_key.member_id)}`;
      const reinserted = change.entries.some(
        (o) => o.table_name === "game_goals" && o.op === "INSERT" && `${s(o.row_key.game_id)}:${s(o.row_key.member_id)}` === key,
      );
      if (reinserted) continue;
    }
    const line = describeEntry(e, names);
    if (line && !lines.includes(line)) lines.push(line);
  }
  return lines.length ? lines : ["Alteração nos dados da pelada"];
}

/** Ids das alterações que ainda dá para desfazer (entre as 5 mais recentes, não desfeitas). */
export function undoableIds(changes: Change[]): Set<string> {
  return new Set(changes.slice(0, UNDO_LIMIT).filter((c) => !c.undoneAt).map((c) => c.id));
}

/** Mensagem para o organizador quando o banco recusa o desfazer. */
export function undoErrorMessage(message: string): string {
  if (message.includes("conflito")) {
    return "Não deu para desfazer: isso foi mudado de novo depois. Desfaça antes a alteração mais nova ou ajuste na mão.";
  }
  if (message.includes("jogador com historico")) {
    return "Esse jogador já tem presença ou pagamento. Para tirá-lo, use Jogadores > Tirar do grupo.";
  }
  if (message.includes("5 alterações")) return "Só dá para desfazer as 5 alterações mais recentes.";
  if (message.includes("já foi desfeita")) return "Essa alteração já foi desfeita.";
  if (message.includes("só leitura")) return "A assinatura venceu: o grupo está só leitura.";
  return "Não deu para desfazer. Tente de novo.";
}
