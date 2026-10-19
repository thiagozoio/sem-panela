export type Sport = "futsal" | "society" | "campo" | "volei";

/** "linha" é a posição coringa: joga onde precisar (no vôlei, "qualquer posição"). */
export type Position =
  | "linha"
  | "goleiro"
  | "fixo"
  | "ala"
  | "pivo"
  | "zagueiro"
  | "lateral"
  | "volante"
  | "meio"
  | "atacante"
  | "levantador"
  | "oposto"
  | "ponteiro"
  | "central"
  | "libero";

type PositionInfo = { value: Position; label: string; short: string };

export const SPORTS: { value: Sport; label: string }[] = [
  { value: "society", label: "Society" },
  { value: "futsal", label: "Futsal" },
  { value: "campo", label: "Futebol de campo" },
  { value: "volei", label: "Vôlei" },
];

export const DEFAULT_SPORT: Sport = "society";

const GK: PositionInfo = { value: "goleiro", label: "Goleiro", short: "GOL" };
const ZAG: PositionInfo = { value: "zagueiro", label: "Zagueiro", short: "ZAG" };
const LAT: PositionInfo = { value: "lateral", label: "Lateral", short: "LAT" };
const MEI: PositionInfo = { value: "meio", label: "Meio-campo", short: "MEI" };
const ATA: PositionInfo = { value: "atacante", label: "Atacante", short: "ATA" };

/** Posições de cada modalidade, da defesa para o ataque (sem a coringa). */
const POSITIONS: Record<Sport, PositionInfo[]> = {
  futsal: [
    GK,
    { value: "fixo", label: "Fixo", short: "FIX" },
    { value: "ala", label: "Ala", short: "ALA" },
    { value: "pivo", label: "Pivô", short: "PIV" },
  ],
  society: [GK, ZAG, LAT, MEI, ATA],
  campo: [GK, ZAG, LAT, { value: "volante", label: "Volante", short: "VOL" }, MEI, ATA],
  volei: [
    { value: "levantador", label: "Levantador", short: "LEV" },
    { value: "oposto", label: "Oposto", short: "OPO" },
    { value: "ponteiro", label: "Ponteiro", short: "PON" },
    { value: "central", label: "Central", short: "CEN" },
    { value: "libero", label: "Líbero", short: "LÍB" },
  ],
};

export const ALL_POSITIONS: Position[] = [
  "linha",
  ...new Set(Object.values(POSITIONS).flatMap((list) => list.map((p) => p.value))),
];

export function sportOf(value: string | null | undefined): Sport {
  return SPORTS.some((s) => s.value === value) ? (value as Sport) : DEFAULT_SPORT;
}

export function sportLabel(sport: Sport): string {
  return SPORTS.find((s) => s.value === sport)?.label ?? "";
}

/** Opções do campo "Posição" na modalidade, com a coringa primeiro. */
export function positionOptions(sport: Sport): { value: Position; label: string }[] {
  const flex = sport === "volei" ? "Qualquer posição" : "Linha (qualquer posição)";
  return [{ value: "linha", label: flex }, ...POSITIONS[sport]];
}

/** Posição valendo na modalidade; uma de outra modalidade vira coringa. */
export function positionOf(sport: Sport, position: string): Position {
  return POSITIONS[sport].some((p) => p.value === position) ? (position as Position) : "linha";
}

export function positionInfo(sport: Sport, position: string): PositionInfo | null {
  return POSITIONS[sport].find((p) => p.value === position) ?? null;
}

/** Ordem dentro do time: goleiro, defesa até ataque, coringas por último. */
export function positionRank(sport: Sport, position: string): number {
  const i = POSITIONS[sport].findIndex((p) => p.value === position);
  return i < 0 ? POSITIONS[sport].length : i;
}

/** Ordena jogadores por posição (goleiro primeiro) e nome. */
export function byPosition(sport: Sport) {
  return (a: { position: string; name: string }, b: { position: string; name: string }) =>
    positionRank(sport, a.position) - positionRank(sport, b.position) || a.name.localeCompare(b.name, "pt-BR");
}
