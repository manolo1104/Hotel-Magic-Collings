// ============================================================
// TEMPORADAS — subir o bajar el precio de ciertas noches
//
// El hotel cobra por tipo de habitación y por ocupación (lib/booking/engine.ts,
// `precioPorNoche`). Una temporada ajusta ESE precio en un rango de fechas,
// de dos maneras:
//   · porcentaje → +20 sube un 20%, -15 baja un 15%
//   · precio     → la noche cuesta exactamente eso, sin importar la tarifa
//
// Reglas que se eligieron a propósito, porque son las que menos sorprenden a
// quien administra el hotel:
//   1. `desde` y `hasta` son NOCHES y las dos entran. "Del 31 de octubre al 2
//      de noviembre" encarece las noches del 31, del 1 y del 2. Nadie piensa en
//      temporadas con fecha de salida.
//   2. Los ajustes NO se enciman. En una noche manda UNA sola temporada: la que
//      tiene categoría concreta le gana a la general, y entre dos del mismo
//      alcance gana la más reciente. Si se acumularan, dos descuentos del 20%
//      darían 36% y nadie lo esperaría.
//   3. Una noche nunca puede quedar por debajo de $1: un -100% dejaría cuartos
//      gratis y un pago de $0 que Mercado Pago rechaza.
//
// Este archivo es PURO a propósito: no importa la base de datos, así que el
// panel puede usar las MISMAS cuentas para enseñar la vista previa sin
// arrastrar drizzle al bundle del navegador.
// ============================================================

export type TipoAjuste = "porcentaje" | "precio";

export interface Temporada {
  id: string;
  nombre: string;
  desde: string; // ISO yyyy-mm-dd, primera noche (incluida)
  hasta: string; // ISO yyyy-mm-dd, última noche (incluida)
  roomTypeId: string | null; // null = todas las categorías
  tipoAjuste: TipoAjuste;
  valor: number;
  activa: boolean;
}

/** Igual que `Temporada`, más el nombre de la categoría para enseñarlo. */
export interface TemporadaView extends Temporada {
  nombreTipo: string; // "Todas las habitaciones" si no tiene categoría
  noches: number;
}

export interface TemporadaInput {
  nombre: string;
  desde: string;
  hasta: string;
  roomTypeId?: string | null;
  tipoAjuste: TipoAjuste;
  valor: number;
  activa?: boolean;
}

// ── Fechas ──────────────────────────────────────────────────
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaValida(v: string): boolean {
  if (!ISO.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00Z`).getTime();
  const b = new Date(`${hasta}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Las NOCHES de una estancia: de la llegada (incluida) a la salida (excluida).
 * Un 10→12 de enero son las noches del 10 y del 11; el 12 el huésped ya se fue
 * y esa noche no se cobra.
 */
export function nochesDe(checkin: string, checkout: string): string[] {
  if (!esFechaValida(checkin) || !esFechaValida(checkout)) return [];
  const salida: string[] = [];
  let cursor = checkin;
  // Tope de seguridad: una estancia de más de dos años es un dato corrupto, no
  // una reserva, y sin el límite el bucle no terminaría.
  for (let i = 0; cursor < checkout && i < 731; i++) {
    salida.push(cursor);
    cursor = sumarDias(cursor, 1);
  }
  return salida;
}

// ── Aplicar ─────────────────────────────────────────────────
/**
 * La temporada que manda en una noche concreta, o `undefined` si esa noche va
 * a tarifa normal. `temporadas` debe venir ordenada de más reciente a más
 * antigua (es como la devuelve `temporadasVigentes`).
 */
export function temporadaDeNoche(
  fecha: string,
  roomTypeId: string,
  temporadas: Temporada[],
): Temporada | undefined {
  const tocan = temporadas.filter(
    (t) =>
      t.activa &&
      fecha >= t.desde &&
      fecha <= t.hasta &&
      (t.roomTypeId === null || t.roomTypeId === roomTypeId),
  );
  if (tocan.length === 0) return undefined;
  // La de categoría concreta le gana a la general; entre iguales, la primera
  // de la lista, que es la más reciente.
  return tocan.find((t) => t.roomTypeId !== null) ?? tocan[0];
}

/** Precio de una noche ya con la temporada aplicada. Nunca baja de $1. */
export function precioDeNoche(base: number, temporada?: Temporada): number {
  if (!temporada) return Math.max(1, Math.round(base));
  if (temporada.tipoAjuste === "precio") return Math.max(1, Math.round(temporada.valor));
  return Math.max(1, Math.round(base * (1 + temporada.valor / 100)));
}

export interface DesgloseEstancia {
  /** Total de la estancia en MXN, ya con temporadas. */
  total: number;
  /** Tarifa de lista de una noche, sin temporadas. */
  precioBase: number;
  /** Lo que cuesta una noche en promedio (= precioBase si no hubo temporada). */
  precioNoche: number;
  /** true cuando no todas las noches cuestan lo mismo. */
  mixto: boolean;
  /** Nombres de las temporadas que tocaron la estancia, sin repetir. */
  temporadas: string[];
  /** Precio de cada noche, por si se quiere enseñar el detalle. */
  porNoche: { fecha: string; precio: number; temporada: string | null }[];
}

/**
 * Cotiza una estancia noche por noche. `base` es lo que costaría UNA noche a
 * tarifa normal para esa ocupación (lo da `precioPorNoche`).
 */
export function desglosarEstancia(
  base: number,
  roomTypeId: string,
  checkin: string,
  checkout: string,
  temporadas: Temporada[],
): DesgloseEstancia {
  const noches = nochesDe(checkin, checkout);
  const porNoche = noches.map((fecha) => {
    const t = temporadaDeNoche(fecha, roomTypeId, temporadas);
    return { fecha, precio: precioDeNoche(base, t), temporada: t?.nombre ?? null };
  });
  const total = porNoche.reduce((suma, n) => suma + n.precio, 0);
  const nombres = [...new Set(porNoche.map((n) => n.temporada).filter(Boolean))] as string[];
  const distintos = new Set(porNoche.map((n) => n.precio));
  return {
    total,
    precioBase: Math.max(1, Math.round(base)),
    precioNoche:
      porNoche.length === 0 ? Math.max(1, Math.round(base)) : Math.round(total / porNoche.length),
    mixto: distintos.size > 1,
    temporadas: nombres,
    porNoche,
  };
}
