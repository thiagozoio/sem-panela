/** Marca do Coletinho: três coletes de treino (azul, laranja e amarelo), sem fundo. */
const BIB = "M-26-102H-54Q-58-40-84-28V90Q-84 106-68 108Q0 116 68 108Q84 106 84 90V-28Q58-40 54-102H26Q0-14-26-102Z";
const TRIM = "M-54-102Q-58-40-84-28M84-28Q58-40 54-102M26-102Q0-14-26-102";

const BIBS: [number, number, number, string][] = [
  [-86, 8, -16, "#2563eb"],
  [86, 8, 16, "#ea580c"],
  [0, -6, 0, "#facc15"],
];

export function BrandMark({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="40 110 432 330" className={className} aria-hidden="true">
      <g transform="translate(256 268) scale(1.12)">
        {BIBS.map(([x, y, r, color]) => (
          <g key={color} transform={`translate(${x} ${y}) rotate(${r})`}>
            <path d={BIB} transform="translate(6 10)" fill="#000" fillOpacity={0.2} />
            <path d={BIB} fill={color} />
            <path d={TRIM} fill="none" stroke="#000" strokeOpacity={0.2} strokeWidth={7} strokeLinecap="round" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Nome com a marca, para o topo das telas. */
export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BrandMark className="h-6 w-auto" />
      Coletinho
    </span>
  );
}
