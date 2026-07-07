// ============================================================
// CLIENTE MERCADO PAGO — solo servidor (pago embebido con Bricks)
// El sitio ofrece pago en línea SÓLO si MP_ACCESS_TOKEN está configurado.
// Sin esa variable, el flujo de reserva sigue siendo el de WhatsApp.
// ============================================================
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

const accessToken = process.env.MP_ACCESS_TOKEN;

/** ¿Está configurado Mercado Pago? Controla si se ofrece pago en línea. */
export function pagosActivos(): boolean {
  return Boolean(accessToken && accessToken.trim().length > 0);
}

/** Public Key para el formulario embebido (frontend). */
export function mpPublicKey(): string {
  return process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "";
}

function client(): MercadoPagoConfig {
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN no configurado");
  return new MercadoPagoConfig({ accessToken });
}

export interface CrearPreferenciaInput {
  bookingId: string;
  titulo: string;
  monto: number; // MXN (entero)
  baseUrl: string; // sin slash final
  email?: string;
  nombre?: string;
}

export interface PreferenciaCreada {
  preferenceId: string;
  initPoint: string; // URL de Checkout Pro a la que redirigir al huésped
}

/** Crea una preferencia de Checkout Pro. external_reference = bookingId. */
export async function crearPreferencia(
  input: CrearPreferenciaInput,
): Promise<PreferenciaCreada> {
  const pref = new Preference(client());
  const https = input.baseUrl.startsWith("https://");
  const res = await pref.create({
    body: {
      items: [
        {
          id: input.bookingId,
          title: input.titulo,
          quantity: 1,
          unit_price: input.monto,
          currency_id: "MXN",
        },
      ],
      external_reference: input.bookingId,
      payer: input.email
        ? { name: input.nombre, email: input.email }
        : undefined,
      back_urls: {
        success: `${input.baseUrl}/reserva/exito?ref=${input.bookingId}`,
        pending: `${input.baseUrl}/reserva/pendiente?ref=${input.bookingId}`,
        failure: `${input.baseUrl}/reserva/error?ref=${input.bookingId}`,
      },
      // auto_return exige back_urls HTTPS públicas (no aplica en localhost)
      ...(https ? { auto_return: "approved" as const } : {}),
      notification_url: `${input.baseUrl}/api/mp/webhook`,
      metadata: { booking_id: input.bookingId },
      statement_descriptor: "MAGICCOLLINN",
    },
  });
  const initPoint = res.init_point ?? res.sandbox_init_point;
  if (!res.id || !initPoint) {
    throw new Error("Mercado Pago no devolvió una preferencia válida");
  }
  return { preferenceId: res.id, initPoint };
}

export interface PagoMP {
  status: string; // approved | pending | in_process | rejected | cancelled | refunded ...
  bookingId: string | null; // external_reference
  monto: number; // transaction_amount (MXN, entero)
  paymentId: string;
}

/**
 * Consulta un pago por id. Verificación AUTENTICADA (no confiar en el webhook):
 * cualquiera puede hacer POST al webhook; sólo confiamos en lo que la API de MP
 * nos confirma con nuestro token.
 */
export async function obtenerPago(paymentId: string): Promise<PagoMP> {
  const pay = new Payment(client());
  const res = await pay.get({ id: paymentId });
  return {
    status: String(res.status ?? "unknown"),
    bookingId: res.external_reference ?? null,
    monto: Math.round(res.transaction_amount ?? 0),
    paymentId: String(res.id ?? paymentId),
  };
}

// ── Pago embebido (Bricks) ──────────────────────────────────
export interface BrickFormData {
  token?: string;
  installments?: number;
  payment_method_id?: string;
  issuer_id?: string;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
}

export interface ProcesarPagoInput {
  bookingId: string;
  monto: number; // MXN (entero)
  descripcion: string;
  baseUrl: string;
  formData: BrickFormData;
}

export interface PagoProcesado {
  status: string; // approved | in_process | pending | rejected
  statusDetail: string;
  paymentId: string;
  monto: number;
}

/**
 * Procesa un pago con el token que generó el Payment Brick (frontend).
 * El dato sensible de la tarjeta nunca toca nuestro servidor: el Brick lo
 * convierte en un token de un solo uso que aquí se cobra.
 */
export async function procesarPago(
  input: ProcesarPagoInput,
): Promise<PagoProcesado> {
  const pay = new Payment(client());
  const fd = input.formData ?? {};
  // MP exige que notification_url sea una URL pública válida; rechaza localhost
  // (y cualquier http). En desarrollo se omite: el cobro síncrono igual confirma;
  // en producción (https) sí se envía para que el webhook respalde el flujo.
  const notifUrl = input.baseUrl.startsWith("https://")
    ? `${input.baseUrl}/api/mp/webhook`
    : undefined;
  const res = await pay.create({
    body: {
      transaction_amount: input.monto,
      token: fd.token,
      description: input.descripcion,
      installments: Number(fd.installments) || 1,
      payment_method_id: fd.payment_method_id,
      issuer_id: fd.issuer_id ? Number(fd.issuer_id) : undefined,
      payer: {
        email: fd.payer?.email,
        identification: fd.payer?.identification,
      },
      external_reference: input.bookingId,
      ...(notifUrl ? { notification_url: notifUrl } : {}),
      metadata: { booking_id: input.bookingId },
    },
  });
  return {
    status: String(res.status ?? "unknown"),
    statusDetail: String(res.status_detail ?? ""),
    paymentId: String(res.id ?? ""),
    monto: Math.round(res.transaction_amount ?? input.monto),
  };
}
