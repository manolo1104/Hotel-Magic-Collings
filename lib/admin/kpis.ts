// ============================================================
// KPIs financieros del hotel (puro, sobre filas Drizzle)
// Ingreso de una reserva = su `total`, atribuido al mes de check-in.
// ============================================================
import { isReservaActiva, type BookingView } from "@/lib/booking/engine";

export interface KPIData {
  ingresoMes: number;
  reservasMes: number;
  nochesMes: number;
  ocupacionMes: number; // 0-100
  adr: number; // tarifa promedio por noche
  revpar: number; // ingreso por cuarto disponible
  ingresoMesAnterior: number;
  deltaIngresoPct: number | null;
  ingresoAnio: number;
  reservasAnio: number;
  porTipo: { nombre: string; reservas: number; ingreso: number }[];
  porOrigen: { origen: string; reservas: number; ingreso: number }[];
  porNosConociste: { canal: string; reservas: number; ingreso: number }[];
  serie: { mes: string; etiqueta: string; ingreso: number }[];
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function ym(iso: string): string {
  return iso.slice(0, 7); // yyyy-mm
}
function noches(b: BookingView): number {
  const a = new Date(`${b.checkin}T12:00:00`).getTime();
  const c = new Date(`${b.checkout}T12:00:00`).getTime();
  return Math.max(0, Math.round((c - a) / 86_400_000));
}

export function calcKPIs(
  bookings: BookingView[],
  totalRooms: number,
  hoy: Date,
): KPIData {
  // "Activa" = ocupa inventario (excluye holds de pago vencidos), coherente
  // con disponibilidad/calendario para no inflar ingresos con pagos abandonados.
  const activas = bookings.filter((b) => isReservaActiva(b, hoy));
  const y = hoy.getFullYear();
  const m = hoy.getMonth(); // 0-11
  const mesActual = `${y}-${String(m + 1).padStart(2, "0")}`;
  const prev = new Date(y, m - 1, 1);
  const mesPrev = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const diasMes = new Date(y, m + 1, 0).getDate();

  const delMes = activas.filter((b) => ym(b.checkin) === mesActual);
  const ingresoMes = delMes.reduce((s, b) => s + b.total, 0);
  const nochesMes = delMes.reduce((s, b) => s + noches(b), 0);
  const capacidadMes = totalRooms * diasMes;
  const ocupacionMes = capacidadMes > 0 ? Math.round((nochesMes / capacidadMes) * 100) : 0;
  const adr = nochesMes > 0 ? Math.round(ingresoMes / nochesMes) : 0;
  const revpar = capacidadMes > 0 ? Math.round(ingresoMes / capacidadMes) : 0;

  const ingresoMesAnterior = activas
    .filter((b) => ym(b.checkin) === mesPrev)
    .reduce((s, b) => s + b.total, 0);
  const deltaIngresoPct =
    ingresoMesAnterior > 0
      ? Math.round(((ingresoMes - ingresoMesAnterior) / ingresoMesAnterior) * 100)
      : null;

  const delAnio = activas.filter((b) => b.checkin.slice(0, 4) === String(y));
  const ingresoAnio = delAnio.reduce((s, b) => s + b.total, 0);

  const tipoMap = new Map<string, { reservas: number; ingreso: number }>();
  const origenMap = new Map<string, { reservas: number; ingreso: number }>();
  const conocisteMap = new Map<string, { reservas: number; ingreso: number }>();
  for (const b of delAnio) {
    const t = tipoMap.get(b.nombreTipo) ?? { reservas: 0, ingreso: 0 };
    t.reservas++;
    t.ingreso += b.total;
    tipoMap.set(b.nombreTipo, t);
    const o = origenMap.get(b.origen) ?? { reservas: 0, ingreso: 0 };
    o.reservas++;
    o.ingreso += b.total;
    origenMap.set(b.origen, o);
    if (b.nosConociste) {
      const c = conocisteMap.get(b.nosConociste) ?? { reservas: 0, ingreso: 0 };
      c.reservas++;
      c.ingreso += b.total;
      conocisteMap.set(b.nosConociste, c);
    }
  }

  const serie: KPIData["serie"] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(y, m - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const ingreso = activas
      .filter((b) => ym(b.checkin) === key)
      .reduce((s, b) => s + b.total, 0);
    serie.push({ mes: key, etiqueta: MESES[d.getMonth()], ingreso });
  }

  return {
    ingresoMes,
    reservasMes: delMes.length,
    nochesMes,
    ocupacionMes,
    adr,
    revpar,
    ingresoMesAnterior,
    deltaIngresoPct,
    ingresoAnio,
    reservasAnio: delAnio.length,
    porTipo: Array.from(tipoMap.entries())
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.ingreso - a.ingreso),
    porOrigen: Array.from(origenMap.entries())
      .map(([origen, v]) => ({ origen, ...v }))
      .sort((a, b) => b.ingreso - a.ingreso),
    porNosConociste: Array.from(conocisteMap.entries())
      .map(([canal, v]) => ({ canal, ...v }))
      .sort((a, b) => b.ingreso - a.ingreso),
    serie,
  };
}
