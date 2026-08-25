// ============================================================
// TIPOS DEL DOMINIO DE RESERVAS
// ============================================================

export interface AvailabilityParams {
  checkin: string; // ISO yyyy-mm-dd
  checkout: string; // ISO yyyy-mm-dd
  huespedes: number;
  includeHidden?: boolean; // incluye tipos internos (p. ej. cuarto de prueba)
}

export interface AvailableRoomType {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  capacidad: number;
  tarifaBase: number;
  amenidades: string[];
  fotos: string[];
  disponibles: number; // unidades libres en el rango
  noches: number;
  /** Precio de una noche para el número de huéspedes buscado. */
  precioNoche: number;
  precioTotal: number;
}

export interface AvailabilityResult {
  ok: boolean;
  error?: string;
  checkin: string;
  checkout: string;
  huespedes: number;
  noches: number;
  tipos: AvailableRoomType[];
}

// "total" = paga el 100% ahora · "anticipo" = paga el 50% ahora, resto en hotel
// undefined = reserva sin pago en línea (flujo WhatsApp tradicional)
export type ModalidadPago = "total" | "anticipo";

// Opciones del campo "¿De dónde nos conociste?" (compartidas entre el
// formulario público y el panel admin). El campo es opcional y acepta
// también texto libre corto (p. ej. reservas importadas).
export const NOS_CONOCISTE_OPCIONES = [
  "Google",
  "Facebook / Instagram",
  "Booking / Expedia",
  "Recomendación",
  "Ya me había hospedado",
  "Otro",
] as const;

export interface CreateBookingInput {
  slug: string; // tipo de habitación
  checkin: string;
  checkout: string;
  huespedes: number;
  nombre: string;
  whatsapp: string;
  email?: string;
  nosConociste?: string;
  modalidadPago?: ModalidadPago;
}

export interface CreateBookingResult {
  ok: boolean;
  error?: string;
  id?: string;
  estado?: string;
  total?: number;
  // Presentes cuando se reserva con pago en línea (modalidadPago definido)
  modalidadPago?: ModalidadPago;
  montoACobrar?: number; // MXN a cobrar ahora
  saldoPendiente?: number; // MXN a pagar en el hotel
  nombreTipo?: string; // nombre del tipo de habitación (para el cobro)
}

/**
 * Cómo entró el dinero. Es distinto de `estadoPago` (cuánto se cobró) y de
 * `modalidadPago` (total o anticipo): esto es por qué vía.
 *
 * `mercado_pago` lo pone solo el checkout en línea; el resto los elige el dueño
 * en el panel cuando cobra fuera del sitio.
 */
export const FORMAS_PAGO = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "tarjeta", etiqueta: "Tarjeta (terminal)" },
  { valor: "deposito", etiqueta: "Depósito bancario" },
  { valor: "oxxo", etiqueta: "OXXO" },
  { valor: "mercado_pago", etiqueta: "Mercado Pago (en línea)" },
] as const;

export type FormaPago = (typeof FORMAS_PAGO)[number]["valor"];

export function etiquetaFormaPago(valor: string | null | undefined): string {
  return FORMAS_PAGO.find((f) => f.valor === valor)?.etiqueta ?? "";
}
