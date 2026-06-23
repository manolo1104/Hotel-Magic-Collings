// ============================================================
// CRM de huéspedes (puro) — agrega reservas por email.
// ============================================================
import type { BookingView } from "@/lib/booking/engine";

export interface GuestStay {
  ref: string;
  checkin: string;
  checkout: string;
  tipo: string;
  total: number;
  estado: string;
}

export interface GuestProfile {
  email: string;
  nombre: string;
  telefono: string;
  totalReservas: number;
  totalGastado: number;
  ultimaEstancia: string;
  tiposFavoritos: string[];
  notas: string;
  historial: GuestStay[];
}

export function buildCRM(
  bookings: BookingView[],
  notas: Record<string, string>,
): GuestProfile[] {
  const map = new Map<string, GuestProfile>();
  for (const b of bookings) {
    if (!b.email) continue;
    const email = b.email.toLowerCase();
    let p = map.get(email);
    if (!p) {
      p = {
        email,
        nombre: b.nombre,
        telefono: b.whatsapp,
        totalReservas: 0,
        totalGastado: 0,
        ultimaEstancia: "",
        tiposFavoritos: [],
        notas: notas[email] ?? "",
        historial: [],
      };
      map.set(email, p);
    }
    const cancelada = b.estado === "cancelada" || b.estado === "expirada";
    if (!cancelada) {
      p.totalReservas++;
      p.totalGastado += b.total;
      if (b.checkin > p.ultimaEstancia) p.ultimaEstancia = b.checkin;
      if (!p.tiposFavoritos.includes(b.nombreTipo)) p.tiposFavoritos.push(b.nombreTipo);
    }
    p.historial.push({
      ref: b.id.slice(0, 8).toUpperCase(),
      checkin: b.checkin,
      checkout: b.checkout,
      tipo: b.nombreTipo,
      total: b.total,
      estado: b.estado,
    });
  }
  for (const p of map.values())
    p.historial.sort((a, b) => (a.checkin < b.checkin ? 1 : -1));
  return Array.from(map.values()).sort((a, b) => b.totalGastado - a.totalGastado);
}
