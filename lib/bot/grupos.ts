// ============================================================
// GRUPOS — cómo repartir a mucha gente en varios cuartos
// Función PURA (sin base de datos) para poder probarla sola: recibe lo que
// hay libre y lo que cuesta cada cuarto según cuántos duermen en él, y
// devuelve las combinaciones con menos cuartos y, entre ellas, las más baratas.
// ============================================================

export type TipoParaGrupo = {
  slug: string;
  nombre: string;
  capacidad: number;
  disponibles: number;
  /** Total de la estancia según ocupación: posición 0 = 1 persona. */
  totalPorOcupacion: number[];
};

export type CuartoDeGrupo = { slug: string; nombre: string; huespedes: number; total: number };
export type OpcionGrupo = { cuartos: number; total: number; habitaciones: CuartoDeGrupo[] };

/** Cuántos cuartos por tipo: todas las combinaciones posibles (son pocas). */
function combinaciones(tipos: TipoParaGrupo[], maxCuartos: number): number[][] {
  const salida: number[][] = [];
  const actual: number[] = [];
  const recorrer = (i: number, usados: number) => {
    if (i === tipos.length) {
      if (usados > 0) salida.push([...actual]);
      return;
    }
    for (let n = 0; n <= tipos[i].disponibles && usados + n <= maxCuartos; n++) {
      actual.push(n);
      recorrer(i + 1, usados + n);
      actual.pop();
    }
  };
  recorrer(0, 0);
  return salida;
}

/**
 * Reparte `huespedes` entre los cuartos (cada uno con al menos 1 persona y sin
 * pasar su capacidad) al menor precio posible. `null` si no caben.
 */
function repartir(
  cuartos: TipoParaGrupo[],
  huespedes: number,
): { total: number; porCuarto: number[] } | null {
  const INF = Number.POSITIVE_INFINITY;
  // mejor[i][g] = costo mínimo con los primeros i cuartos y g personas
  const mejor: number[][] = Array.from({ length: cuartos.length + 1 }, () =>
    new Array<number>(huespedes + 1).fill(INF),
  );
  const eleccion: number[][] = Array.from({ length: cuartos.length + 1 }, () =>
    new Array<number>(huespedes + 1).fill(0),
  );
  mejor[0][0] = 0;
  for (let i = 1; i <= cuartos.length; i++) {
    const c = cuartos[i - 1];
    for (let g = 0; g <= huespedes; g++) {
      for (let k = 1; k <= Math.min(c.capacidad, g); k++) {
        const previo = mejor[i - 1][g - k];
        const precio = c.totalPorOcupacion[Math.min(k, c.totalPorOcupacion.length) - 1];
        if (previo === INF || precio == null) continue;
        if (previo + precio < mejor[i][g]) {
          mejor[i][g] = previo + precio;
          eleccion[i][g] = k;
        }
      }
    }
  }
  if (mejor[cuartos.length][huespedes] === INF) return null;
  const porCuarto: number[] = [];
  for (let i = cuartos.length, g = huespedes; i > 0; i--) {
    porCuarto.unshift(eleccion[i][g]);
    g -= eleccion[i][g];
  }
  return { total: mejor[cuartos.length][huespedes], porCuarto };
}

/**
 * Hasta `cuantas` formas de acomodar al grupo, ordenadas por número de cuartos
 * y luego por precio. Solo se ofrecen las que usan como mucho UN cuarto más que
 * la mínima: a nadie le sirve una opción de 5 cuartos si caben en 2.
 */
export function opcionesParaGrupo(
  tipos: TipoParaGrupo[],
  huespedes: number,
  { maxCuartos = 7, cuantas = 3 } = {},
): OpcionGrupo[] {
  const n = Math.floor(huespedes);
  if (!(n >= 1)) return [];
  const utiles = tipos.filter((t) => t.disponibles > 0 && t.capacidad > 0);
  const opciones: OpcionGrupo[] = [];

  for (const conteo of combinaciones(utiles, Math.min(maxCuartos, n))) {
    const cuartos: TipoParaGrupo[] = [];
    conteo.forEach((veces, i) => {
      for (let k = 0; k < veces; k++) cuartos.push(utiles[i]);
    });
    const capacidad = cuartos.reduce((s, c) => s + c.capacidad, 0);
    if (capacidad < n) continue;
    const reparto = repartir(cuartos, n);
    if (!reparto) continue;
    opciones.push({
      cuartos: cuartos.length,
      total: reparto.total,
      habitaciones: cuartos.map((c, i) => ({
        slug: c.slug,
        nombre: c.nombre,
        huespedes: reparto.porCuarto[i],
        total: c.totalPorOcupacion[Math.min(reparto.porCuarto[i], c.totalPorOcupacion.length) - 1],
      })),
    });
  }

  if (opciones.length === 0) return [];
  const minimo = Math.min(...opciones.map((o) => o.cuartos));
  return opciones
    .filter((o) => o.cuartos <= minimo + 1)
    .sort((a, b) => a.cuartos - b.cuartos || a.total - b.total)
    .slice(0, cuantas);
}
