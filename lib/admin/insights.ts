// ============================================================
// Insights operativos del día (puro, sobre filas Drizzle)
// Foco: qué pasa HOY + pronóstico de ocupación de la semana.
// ============================================================
import type { BookingView } from "@/lib/booking/engine";

export interface MovimientoHoy {
  nombre: string;
  numero: string;
  tipo: string;
  huespedes: number;
}

export interface InsightsData {
  fecha: string;
  totalRooms: number;
  ocupadosHoy: number;
  ocupacionHoyPct: number;
  checkins: MovimientoHoy[];
  checkouts: MovimientoHoy[];
  enCasa: number;
  ingresoMes: number;
  reservasMes: number;
  forecast: { fecha: string; etiqueta: string; ocupados: number; pct: number }[];
  proximasLlegadas: { nombre: string; checkin: string; numero: string; tipo: string }[];
}

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function dISO(d: Date): string {
  return d.toLocaleDateString("en-CA");
}
function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function calcInsights(
  bookings: BookingView[],
  totalRooms: number,
  hoy: Date,
): InsightsData {
  const activas = bookings.filter(
    (b) => b.estado !== "cancelada" && b.estado !== "expirada",
  );
  const fecha = dISO(hoy);
  const ym = fecha.slice(0, 7);

  const mov = (b: BookingView): MovimientoHoy => ({
    nombre: b.nombre,
    numero: b.numeroCuarto,
    tipo: b.nombreTipo,
    huespedes: b.huespedes,
  });

  const checkins = activas.filter((b) => b.checkin === fecha).map(mov);
  const checkouts = activas.filter((b) => b.checkout === fecha).map(mov);
  const enCasaList = activas.filter((b) => b.checkin <= fecha && b.checkout > fecha);

  const delMes = activas.filter((b) => b.checkin.slice(0, 7) === ym);

  const forecast = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(hoy, i);
    const di = dISO(d);
    const ocupados = activas.filter((b) => b.checkin <= di && b.checkout > di).length;
    return {
      fecha: di,
      etiqueta: i === 0 ? "Hoy" : DOW[d.getDay()],
      ocupados,
      pct: totalRooms > 0 ? Math.round((ocupados / totalRooms) * 100) : 0,
    };
  });

  const proximasLlegadas = activas
    .filter((b) => b.checkin > fecha)
    .sort((a, b) => (a.checkin < b.checkin ? -1 : 1))
    .slice(0, 6)
    .map((b) => ({
      nombre: b.nombre,
      checkin: b.checkin,
      numero: b.numeroCuarto,
      tipo: b.nombreTipo,
    }));

  return {
    fecha,
    totalRooms,
    ocupadosHoy: enCasaList.length,
    ocupacionHoyPct:
      totalRooms > 0 ? Math.round((enCasaList.length / totalRooms) * 100) : 0,
    checkins,
    checkouts,
    enCasa: enCasaList.length,
    ingresoMes: delMes.reduce((s, b) => s + b.total, 0),
    reservasMes: delMes.length,
    forecast,
    proximasLlegadas,
  };
}
