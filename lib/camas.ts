// ============================================================
// CAMAS DE CADA HABITACIÓN
//
// `room_types.camas` guarda UNA entrada por cama, en el orden en que se
// muestran: ["king", "litera", "litera"] = una King Size y dos individuales en
// litera. Gersay las cambia en /admin/habitaciones.
//
// Sin base de datos a propósito: esto lo usan el panel (en el navegador), las
// páginas públicas, el JSON-LD, /llms.txt y el bot.
// ============================================================

/** `opcion` = como sale en el panel y en schema.org; `una`/`varias` = en el sitio. */
export const TIPOS_CAMA = {
  king: { opcion: "King Size", una: "King Size", varias: "King Size" },
  queen: { opcion: "Queen Size", una: "Queen Size", varias: "Queen Size" },
  matrimonial: { opcion: "Matrimonial", una: "matrimonial", varias: "matrimoniales" },
  individual: { opcion: "Individual", una: "individual", varias: "individuales" },
  litera: {
    opcion: "Individual en litera",
    una: "individual en litera",
    varias: "individuales en litera",
  },
  sofacama: { opcion: "Sofá cama", una: "sofá cama", varias: "sofás cama" },
} as const;

export type TipoCama = keyof typeof TIPOS_CAMA;
export type GrupoCamas = { tipo: TipoCama; cantidad: number };

export function esTipoCama(valor: unknown): valor is TipoCama {
  return typeof valor === "string" && Object.keys(TIPOS_CAMA).includes(valor);
}

/** ["king", "litera", "litera"] → [{king, 1}, {litera, 2}], en el orden en que aparecen. */
export function agruparCamas(camas: readonly string[]): GrupoCamas[] {
  const grupos: GrupoCamas[] = [];
  for (const tipo of camas) {
    if (!esTipoCama(tipo)) continue;
    const grupo = grupos.find((g) => g.tipo === tipo);
    if (grupo) grupo.cantidad += 1;
    else grupos.push({ tipo, cantidad: 1 });
  }
  return grupos;
}

/** Lo contrario de `agruparCamas`: lo que se guarda en la base. */
export function desagruparCamas(grupos: readonly GrupoCamas[]): TipoCama[] {
  return grupos.flatMap((g) => Array<TipoCama>(g.cantidad).fill(g.tipo));
}

function nombreGrupo({ tipo, cantidad }: GrupoCamas): string {
  const t = TIPOS_CAMA[tipo];
  return cantidad === 1 ? t.una : t.varias;
}

/** Para las tarjetas: «1 King Size · 2 individuales en litera». */
export function camasCorto(camas: readonly string[]): string {
  return agruparCamas(camas)
    .map((g) => `${g.cantidad} ${nombreGrupo(g)}`)
    .join(" · ");
}

/** Para una frase: «1 cama King Size y 2 camas individuales en litera». */
export function camasLargo(camas: readonly string[]): string {
  const partes = agruparCamas(camas).map((g) =>
    g.tipo === "sofacama"
      ? `${g.cantidad} ${nombreGrupo(g)}`
      : `${g.cantidad} ${g.cantidad === 1 ? "cama" : "camas"} ${nombreGrupo(g)}`,
  );
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}
