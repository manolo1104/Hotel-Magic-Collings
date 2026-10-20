// ============================================================
// DISPONIBILIDAD PARA EL BOT — el MISMO motor que la web
// Todo precio sale de getAvailability / desglosarEstancia: el bot nunca
// tiene su propia tabla de tarifas (en Paraíso vivían copiadas en 3 lugares
// y se desincronizaban).
// ============================================================
import { and, gt, lt } from "drizzle-orm";
import { db } from "../db";
import { ensureDb } from "../db/ensure";
import { blocks, bookings, roomTypes, rooms } from "../db/schema";
import {
  HIDDEN_SLUGS,
  calcNights,
  getAvailability,
  precioPorNoche,
  todayISO,
} from "../booking/engine";
import { desglosarEstancia, temporadasVigentes } from "../booking/temporadas";
import { CIERRE, MAX_CUARTOS, cierreVigente } from "./config";
import { fechaLarga, sumarDias } from "./fechas";
import { opcionesParaGrupo, type OpcionGrupo, type TipoParaGrupo } from "./grupos";

export type OpcionUnCuarto = {
  slug: string;
  nombre: string;
  capacidad: number;
  cuartos_libres: number;
  total_estancia: number;
  precio_noche: number;
  precio_noche_varia: boolean;
  temporadas: string[];
};

export type Alternativa = {
  checkin: string;
  checkout: string;
  desde_total: number; // la opción más barata en esas fechas
};

export type ResultadoDisponibilidad =
  | { ok: false; error: string }
  | {
      ok: true;
      checkin: string;
      checkout: string;
      noches: number;
      huespedes: number;
      opciones_un_cuarto: OpcionUnCuarto[];
      opciones_varios_cuartos: OpcionGrupo[];
      hay_lugar: boolean;
      aviso_cierre?: string;
      fechas_alternativas?: Alternativa[];
    };

/** Personas a partir de las cuales se ofrecen también combinaciones de cuartos. */
const GRUPO_DESDE = 5;

export async function consultarDisponibilidad(p: {
  checkin: string;
  checkout: string;
  huespedes: number;
}): Promise<ResultadoDisponibilidad> {
  const huespedes = Math.floor(Number(p.huespedes));
  const r = await getAvailability({ checkin: p.checkin, checkout: p.checkout, huespedes });
  if (!r.ok) return { ok: false, error: r.error ?? "Fechas no válidas." };

  const opciones_un_cuarto: OpcionUnCuarto[] = r.tipos.map((t) => ({
    slug: t.slug,
    nombre: t.nombre,
    capacidad: t.capacidad,
    cuartos_libres: t.disponibles,
    total_estancia: t.precioTotal,
    precio_noche: t.precioNoche,
    precio_noche_varia: t.precioMixto,
    temporadas: t.temporadas,
  }));

  const opciones_varios_cuartos =
    huespedes >= GRUPO_DESDE || opciones_un_cuarto.length === 0
      ? await gruposPara(p.checkin, p.checkout, huespedes)
      : [];

  const hay_lugar = opciones_un_cuarto.length > 0 || opciones_varios_cuartos.length > 0;
  const hoy = todayISO();
  const aviso_cierre =
    cierreVigente(hoy) && p.checkin <= CIERRE.hasta
      ? `El hotel está cerrado por temporada hasta el ${fechaLarga(CIERRE.hasta)}; reabre el ${fechaLarga(CIERRE.reabre)}.`
      : undefined;

  const fechas_alternativas = hay_lugar
    ? undefined
    : await alternativas(r.noches, huespedes, sumarDias(p.checkin, 1));

  return {
    ok: true,
    checkin: r.checkin,
    checkout: r.checkout,
    noches: r.noches,
    huespedes,
    opciones_un_cuarto,
    opciones_varios_cuartos,
    hay_lugar,
    ...(aviso_cierre ? { aviso_cierre } : {}),
    ...(fechas_alternativas ? { fechas_alternativas } : {}),
  };
}

/** Combinaciones de varios cuartos con los precios reales de esas noches. */
export async function gruposPara(
  checkin: string,
  checkout: string,
  huespedes: number,
): Promise<OpcionGrupo[]> {
  // Con 1 huésped getAvailability devuelve TODOS los tipos con cuartos libres.
  const [libres, tipos, temporadas] = await Promise.all([
    getAvailability({ checkin, checkout, huespedes: 1 }),
    db.select().from(roomTypes),
    temporadasVigentes(),
  ]);
  if (!libres.ok) return [];
  const porId = new Map(tipos.map((t) => [t.id, t]));
  const paraGrupo: TipoParaGrupo[] = libres.tipos.flatMap((t) => {
    const tipo = porId.get(t.id);
    if (!tipo) return [];
    const totalPorOcupacion = Array.from({ length: tipo.capacidad }, (_, i) =>
      desglosarEstancia(precioPorNoche(tipo, i + 1), tipo.id, checkin, checkout, temporadas).total,
    );
    return [
      {
        slug: tipo.slug,
        nombre: tipo.nombre,
        capacidad: tipo.capacidad,
        disponibles: t.disponibles,
        totalPorOcupacion,
      },
    ];
  });
  return opcionesParaGrupo(paraGrupo, huespedes, { maxCuartos: MAX_CUARTOS });
}

// ── Fechas alternativas ───────────────────────────────────────

export type ReservaOcupante = {
  roomId: string;
  checkin: string;
  checkout: string;
  estado: string;
  estadoPago: string;
  expiraEn: Date | null;
};
export type BloqueoOcupante = { roomId: string; checkin: string; checkout: string };

/**
 * Cuartos ocupados en un rango, con la MISMA regla que `occupiedRoomIds` del
 * motor: cuenta toda reserva activa salvo los apartados de pago vencidos, más
 * todos los bloqueos. Pura, para recorrer meses sin consultar la base día por día.
 */
export function ocupadosEn(
  checkin: string,
  checkout: string,
  reservas: ReservaOcupante[],
  bloqueos: BloqueoOcupante[],
  ahora: Date,
): Set<string> {
  const set = new Set<string>();
  for (const b of reservas) {
    if (b.estado === "cancelada" || b.estado === "expirada") continue;
    if (!(b.checkin < checkout && b.checkout > checkin)) continue;
    const holdVencido =
      b.estadoPago === "iniciado" && b.expiraEn != null && b.expiraEn.getTime() <= ahora.getTime();
    if (holdVencido) continue;
    set.add(b.roomId);
  }
  for (const k of bloqueos) {
    if (k.checkin < checkout && k.checkout > checkin) set.add(k.roomId);
  }
  return set;
}

export type CuartoVendible = { id: string; capacidad: number };

/** ¿Caben `huespedes` en los cuartos libres (uno solo o varios)? */
export function cabenEn(libres: CuartoVendible[], huespedes: number, maxCuartos: number): boolean {
  const caps = libres.map((c) => c.capacidad).sort((a, b) => b - a).slice(0, maxCuartos);
  return caps.reduce((s, c) => s + c, 0) >= huespedes;
}

/**
 * Primeras fechas de llegada (desde `desde`, hasta `maxDias` después) en las
 * que caben, con las mismas noches. Devuelve hasta `cuantas`, separadas al
 * menos 3 días para que sean opciones distintas de verdad.
 */
export function buscarFechasLibres(args: {
  desde: string;
  noches: number;
  huespedes: number;
  cuartos: CuartoVendible[];
  reservas: ReservaOcupante[];
  bloqueos: BloqueoOcupante[];
  ahora: Date;
  maxDias?: number;
  cuantas?: number;
}): string[] {
  const { desde, noches, huespedes, cuartos, reservas, bloqueos, ahora } = args;
  const maxDias = args.maxDias ?? 150;
  const cuantas = args.cuantas ?? 2;
  const salida: string[] = [];
  for (let i = 0; i <= maxDias && salida.length < cuantas; i++) {
    const llegada = sumarDias(desde, i);
    if (salida.length > 0 && i - diasDesde(desde, salida[salida.length - 1]) < 3) continue;
    const salidaFecha = sumarDias(llegada, noches);
    const ocupados = ocupadosEn(llegada, salidaFecha, reservas, bloqueos, ahora);
    const libres = cuartos.filter((c) => !ocupados.has(c.id));
    if (cabenEn(libres, huespedes, MAX_CUARTOS)) salida.push(llegada);
  }
  return salida;
}

function diasDesde(desde: string, fecha: string): number {
  return calcNights(desde, fecha);
}

async function alternativas(
  noches: number,
  huespedes: number,
  desde: string,
): Promise<Alternativa[]> {
  if (noches < 1) return [];
  await ensureDb();
  const hoy = todayISO();
  const inicio = desde < hoy ? hoy : desde;
  const MAX_DIAS = 150;
  const fin = sumarDias(inicio, MAX_DIAS + noches);

  const [tipos, todos, reservas, bloqueos] = await Promise.all([
    db.select().from(roomTypes),
    db.select().from(rooms),
    db
      .select({
        roomId: bookings.roomId,
        checkin: bookings.checkin,
        checkout: bookings.checkout,
        estado: bookings.estado,
        estadoPago: bookings.estadoPago,
        expiraEn: bookings.expiraEn,
      })
      .from(bookings)
      .where(and(lt(bookings.checkin, fin), gt(bookings.checkout, inicio))),
    db
      .select({ roomId: blocks.roomId, checkin: blocks.checkin, checkout: blocks.checkout })
      .from(blocks)
      .where(and(lt(blocks.checkin, fin), gt(blocks.checkout, inicio))),
  ]);

  const tipoPorId = new Map(tipos.map((t) => [t.id, t]));
  const cuartos: CuartoVendible[] = todos.flatMap((c) => {
    const t = tipoPorId.get(c.roomTypeId);
    if (!c.activa || !t || HIDDEN_SLUGS.has(t.slug)) return [];
    return [{ id: c.id, capacidad: t.capacidad }];
  });

  const llegadas = buscarFechasLibres({
    desde: inicio,
    noches,
    huespedes,
    cuartos,
    reservas,
    bloqueos,
    ahora: new Date(),
    maxDias: MAX_DIAS,
  });

  const salida: Alternativa[] = [];
  for (const checkin of llegadas) {
    const checkout = sumarDias(checkin, noches);
    const r = await getAvailability({ checkin, checkout, huespedes });
    let desdeTotal = r.ok && r.tipos.length > 0 ? Math.min(...r.tipos.map((t) => t.precioTotal)) : 0;
    if (!desdeTotal) {
      const grupos = await gruposPara(checkin, checkout, huespedes);
      desdeTotal = grupos[0]?.total ?? 0;
    }
    if (desdeTotal > 0) salida.push({ checkin, checkout, desde_total: desdeTotal });
  }
  return salida;
}
