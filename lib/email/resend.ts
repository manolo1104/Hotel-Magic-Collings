// ============================================================
// CLIENTE DE CORREO — solo servidor. Best-effort (nunca rompe la reserva).
//
// Orden: **RESEND primero** (si RESEND_API_KEY está configurada) y BREVO de
// respaldo. Resend es quien tiene verificado el dominio del hotel, así que es
// el único que puede firmar los correos como `@hotelmagicollinn.com`; Brevo
// solo puede mandar desde `huasteca-potosina.com` (la empresa de tours), por
// eso el respaldo cambia de remitente con MAIL_FROM_RESPALDO.
//
// Si no hay ninguna llave, se omite el envío sin romper nada.
// El remitente (MAIL_FROM / RESEND_FROM) debe ser un remitente o dominio
// VERIFICADO en el proveedor, o los correos no se entregan.
//
// 🔴 `hotelmagicollinn.com` NO tiene registros MX: puede MANDAR correo pero no
// RECIBIRLO. Por eso todo envío lleva `replyTo` a un buzón real; sin eso, un
// huésped que conteste la confirmación recibiría un rebote.
// ============================================================
import { Resend } from "resend";

const brevoKey = process.env.BREVO_API_KEY;
const resendKey = process.env.RESEND_API_KEY;

// Remitente en formato "Nombre <correo@dominio>".
const FROM =
  process.env.MAIL_FROM ||
  process.env.RESEND_FROM ||
  "Magic Collinn <reservas@huasteca-potosina.com>";

// Remitente para el respaldo por Brevo, que NO tiene verificado el dominio del
// hotel. Si se dejara el mismo FROM, el reintento fallaría igual que el envío.
const FROM_RESPALDO =
  process.env.MAIL_FROM_RESPALDO || "Magic Collinn <reservas@huasteca-potosina.com>";

// Buzón al que contesta el huésped. El dominio del hotel no recibe correo, así
// que sin esto las respuestas se pierden.
const REPLY_TO = process.env.MAIL_REPLY_TO || process.env.OWNER_EMAIL?.split(",")[0]?.trim();

/** Separa "Nombre <correo>" en { name, email }. */
function parseFrom(s: string): { name: string; email: string } {
  const m = s.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || "Magic Collinn", email: m[2].trim() };
  return { name: "Magic Collinn", email: s.trim() };
}

/** ¿Está configurado el envío de correos? (Brevo o Resend) */
export function correosActivos(): boolean {
  return Boolean(
    (brevoKey && brevoKey.trim().length > 0) ||
      (resendKey && resendKey.trim().length > 0),
  );
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
}

function toBase64(content: Buffer | string): string {
  return Buffer.isBuffer(content)
    ? content.toString("base64")
    : Buffer.from(content, "utf-8").toString("base64");
}

export async function enviarEmail(args: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<boolean> {
  const hayResend = Boolean(resendKey && resendKey.trim().length > 0);
  const hayBrevo = Boolean(brevoKey && brevoKey.trim().length > 0);

  if (hayResend) {
    if (await enviarResend(resendKey!, args)) return true;
    if (!hayBrevo) return false;
    // Resend falló (dominio sin verificar, cuota, caída…). Antes de rendirse se
    // reintenta por Brevo, pero con SU remitente: el del hotel no está
    // verificado ahí y volvería a fallar.
    console.warn("Resend falló; se reintenta por Brevo con el remitente de respaldo.");
    return enviarBrevo(brevoKey!, args, FROM_RESPALDO);
  }
  if (hayBrevo) return enviarBrevo(brevoKey!, args);
  console.warn("Sin RESEND_API_KEY ni BREVO_API_KEY; se omite el correo.");
  return false;
}

// ── Brevo (API transaccional) ───────────────────────────────
async function enviarBrevo(
  apiKey: string,
  args: {
    to: string | string[];
    subject: string;
    html: string;
    attachments?: EmailAttachment[];
  },
  remitente: string = FROM,
): Promise<boolean> {
  const sender = parseFrom(remitente);
  const to = (Array.isArray(args.to) ? args.to : [args.to]).map((email) => ({
    email,
  }));
  const attachment = args.attachments?.map((a) => ({
    name: a.filename,
    content: toBase64(a.content),
  }));
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to,
        subject: args.subject,
        htmlContent: args.html,
        ...(REPLY_TO ? { replyTo: { email: REPLY_TO } } : {}),
        ...(attachment && attachment.length ? { attachment } : {}),
      }),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error("Error Brevo:", res.status, detalle);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Excepción Brevo:", e);
    return false;
  }
}

// ── Resend (principal: es quien firma con el dominio del hotel) ──
async function enviarResend(
  apiKey: string,
  args: {
    to: string | string[];
    subject: string;
    html: string;
    attachments?: EmailAttachment[];
  },
): Promise<boolean> {
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
      attachments: args.attachments,
    });
    if (error) {
      console.error("Error Resend:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Excepción Resend:", e);
    return false;
  }
}
