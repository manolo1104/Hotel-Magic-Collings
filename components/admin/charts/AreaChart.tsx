"use client";

// Gráfica de área simple en SVG (sin dependencias). Eje X = etiquetas, Y = valor.
export function AreaChart({
  data,
  height = 160,
}: {
  data: { etiqueta: string; valor: number }[];
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.valor));
  const n = data.length;
  const W = 100;
  const pad = 6;
  const usable = height - pad * 2;

  const pts = data.map((d, i) => {
    const x = n === 1 ? W / 2 : (i / (n - 1)) * W;
    const y = pad + usable - (d.valor / max) * usable;
    return { x, y };
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const area = `${line} L${W},${height} L0,${height} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Tendencia de ingresos"
      >
        {/* `--brand` / `--sand` son variables reales en tiempo de ejecución; las
            `--color-*` del @theme inline se sustituyen en compilación y aquí no
            existirían. Dentro de /admin valen la paleta Kora. */}
        <path d={area} fill="var(--brand, #1B4332)" opacity={0.1} />
        <path
          d={line}
          fill="none"
          stroke="var(--brand, #1B4332)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={1.6}
            fill="var(--sand, #52B788)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {data.map((d, i) => (
          <span key={i} className={n > 8 && i % 2 === 1 ? "hidden sm:inline" : ""}>
            {d.etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}
