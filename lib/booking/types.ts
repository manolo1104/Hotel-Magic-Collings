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

export interface CreateBookingInput {
  slug: string; // tipo de habitación
  checkin: string;
  checkout: string;
  huespedes: number;
  nombre: string;
  whatsapp: string;
  email?: string;
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
