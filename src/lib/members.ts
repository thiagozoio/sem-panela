import type { Member } from "./types";

/** É chamado para as peladas (o sócio só paga a mensalidade, mas pode ser chamado num jogo). */
export const plays = (m: Pick<Member, "kind">) => m.kind !== "socio";

/** Entra na cobrança da mensalidade. */
export const paysMonthly = (m: Pick<Member, "kind">) => m.kind === "mensalista" || m.kind === "socio";

/** Jogador do grupo que é chamado para os jogos (fora convidados e sócios). */
export const regularPlayer = (m: Pick<Member, "kind" | "active" | "guest">) => m.active && !m.guest && plays(m);

export const KIND_LABEL: Record<Member["kind"], string> = {
  mensalista: "mensalista",
  avulso: "avulso",
  socio: "sócio",
};
