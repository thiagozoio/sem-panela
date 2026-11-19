/** Cor de um time no placar: vem do nome ("Azul", "Time Laranja"); senão, uma cor pela ordem. */
/** plain: cor que some no fundo claro ou no escuro (branco, amarelo, preto); o nome do time usa a cor do texto e a bola ganha borda. */
export type TeamColor = { bg: string; fg: string; plain?: boolean };

const NAMED: [RegExp, TeamColor][] = [
  [/azul|blue/, { bg: "#2563eb", fg: "#ffffff" }],
  [/vermelh|red|encarnad/, { bg: "#dc2626", fg: "#ffffff" }],
  [/laranja|orange/, { bg: "#ea580c", fg: "#ffffff" }],
  [/amarel|yellow|ouro|dourad/, { bg: "#facc15", fg: "#1c1917", plain: true }],
  [/verde|green/, { bg: "#16a34a", fg: "#ffffff" }],
  [/roxo|lilas|lilás|violeta|purple/, { bg: "#7c3aed", fg: "#ffffff" }],
  [/rosa|pink/, { bg: "#db2777", fg: "#ffffff" }],
  [/preto|negro|black/, { bg: "#1c1917", fg: "#ffffff", plain: true }],
  [/branco|white/, { bg: "#f5f5f4", fg: "#1c1917", plain: true }],
  [/cinza|prata|gray|grey/, { bg: "#71717a", fg: "#ffffff" }],
  [/marrom|bege/, { bg: "#92400e", fg: "#ffffff" }],
];

/** Times sem cor no nome ("Time 1", "Time 2"...): azul, laranja, verde, roxo... */
const PALETTE: TeamColor[] = [
  { bg: "#2563eb", fg: "#ffffff" },
  { bg: "#ea580c", fg: "#ffffff" },
  { bg: "#16a34a", fg: "#ffffff" },
  { bg: "#7c3aed", fg: "#ffffff" },
  { bg: "#db2777", fg: "#ffffff" },
  { bg: "#0891b2", fg: "#ffffff" },
];

const named = (name: string) => NAMED.find(([re]) => re.test(name.toLowerCase()))?.[1];

/** Cores dos times de um jogo: a do nome, e os sem cor no nome pegam da paleta uma que ainda não foi usada. */
export function teamColors(names: string[]): TeamColor[] {
  const used = new Set(names.map(named).filter((c): c is TeamColor => !!c).map((c) => c.bg));
  const free = PALETTE.filter((c) => !used.has(c.bg));
  let next = 0;
  return names.map((name) => named(name) ?? (free.length ? free[next++ % free.length] : PALETTE[next++ % PALETTE.length]));
}
