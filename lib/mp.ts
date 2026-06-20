// ============================================================
// CLIENTE MERCADO PAGO (Checkout Pro) — solo servidor
// El sitio ofrece pago en línea SÓLO si MP_ACCESS_TOKEN está configurado.
// Sin esa variable, el flujo de reserva sigue siendo el de WhatsApp.
// ============================================================
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

const accessToken = process.env.MP_ACCESS_TOKEN;

/** ¿Está configurado Mercado Pago? Controla si se ofrece pago en línea. */
export function pagosActivos(): boolean {
  return Boolean(accessToken && accessToken.trim().length > 0);
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
