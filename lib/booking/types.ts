// ============================================================
// TIPOS DEL DOMINIO DE RESERVAS
// ============================================================

export interface AvailabilityParams {
  checkin: string; // ISO yyyy-mm-dd
  checkout: string; // ISO yyyy-mm-dd
  huespedes: number;
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

export interface CreateBookingInput {
  slug: string; // tipo de habitación
  checkin: string;
  checkout: string;
  huespedes: number;
  nombre: string;
  whatsapp: string;
  email?: string;
}

export interface CreateBookingResult {
  ok: boolean;
  error?: string;
  id?: string;
  estado?: string;
  total?: number;
}
