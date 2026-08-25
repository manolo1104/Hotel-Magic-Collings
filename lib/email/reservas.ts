// ============================================================
// ENVÍO DE CORREOS DE RESERVA — orquesta huésped + dueño
// Se llama desde el webhook de Mercado Pago al confirmarse un pago.
// ============================================================
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rooms, roomTypes } from "@/lib/db/schema";
import type { Booking } from "@/lib/db/schema";
import { site } from "@/lib/site";
import { bookingIcs } from "@/lib/ics";
import { enviarEmail, correosActivos } from "./resend";
import { correoHuesped, correoDueno, type DatosCorreo } from "./templates";

/** Envía la confirmación al huésped (si dio correo) y el aviso al dueño. */
export async function enviarCorreosReserva(b: Booking): Promise<void> {
  if (!correosActivos()) return;

  // Enriquecer con cuarto físico + nombre del tipo
  let numeroCuarto = "—";
  let nombreTipo = "Habitación";
  const [room] = await db.select().from(rooms).where(eq(rooms.id, b.roomId)).limit(1);
  if (room) {
    numeroCuarto = room.numero;
    const [tipo] = await db
      .select()
      .from(roomTypes)
      .where(eq(roomTypes.id, room.roomTypeId))
      .limit(1);
    if (tipo) nombreTipo = tipo.nombre;
  }

  const ref = b.id.slice(0, 8).toUpperCase();
  const datos: DatosCorreo = {
    ref,
    nombre: b.nombre,
    nombreTipo,
    numeroCuarto,
    checkin: b.checkin,
    checkout: b.checkout,
    huespedes: b.huespedes,
    total: b.total,
    montoPagado: b.montoPagado,
    saldoPendiente: b.saldoPendiente ?? Math.max(0, b.total - b.montoPagado),
    modalidad: b.modalidadPago,
    whatsapp: b.whatsapp,
    email: b.email,
    nosConociste: b.nosConociste || null,
    formaPago: b.formaPago || null,
  };

  const ics = bookingIcs({ ref, checkin: b.checkin, checkout: b.checkout });
  const attachments = [
    { filename: "reserva-magic-collinn.ics", content: Buffer.from(ics, "utf-8") },
  ];

  // El panel puede reenviar esto para una reserva hecha a mano y sin cobrar:
  // el asunto tampoco debe prometer un pago que no existe.
  const pagada = datos.montoPagado > 0;

  // Correo al huésped (solo si dejó correo)
  if (b.email) {
    await enviarEmail({
      to: b.email,
      subject: `Tu reserva en Magic Collinn está confirmada (REF ${ref})`,
      html: correoHuesped(datos),
      attachments,
    });
  }

  // Aviso al dueño. OWNER_EMAIL admite VARIOS correos separados por coma
  // (p. ej. "hotel@gmail.com,dueno@gmail.com") → llega a todos.
  const duenos = (process.env.OWNER_EMAIL || site.email)
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  await enviarEmail({
    to: duenos,
    subject: `${pagada ? "Nueva reserva pagada" : "Nueva reserva sin pago en línea"} — ${b.nombre} (REF ${ref})`,
    html: correoDueno(datos),
    attachments,
  });
}
