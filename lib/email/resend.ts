// ============================================================
// CLIENTE DE CORREO — solo servidor. Best-effort (nunca rompe la reserva).
// Transporte principal: BREVO (si BREVO_API_KEY está configurada).
// Respaldo: Resend (si RESEND_API_KEY está configurada).
// Si no hay ninguna llave, se omite el envío sin romper nada.
// El remitente (MAIL_FROM / RESEND_FROM) debe ser un remitente o dominio
// VERIFICADO en el proveedor, o los correos no se entregan.
// ============================================================
import { Resend } from "resend";

const brevoKey = process.env.BREVO_API_KEY;
const resendKey = process.env.RESEND_API_KEY;

// Remitente en formato "Nombre <correo@dominio>".
const FROM =
  process.env.MAIL_FROM ||
  process.env.RESEND_FROM ||
  "Magic Collinn <reservas@huasteca-potosina.com>";

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
  if (brevoKey && brevoKey.trim().length > 0) return enviarBrevo(brevoKey, args);
  if (resendKey && resendKey.trim().length > 0)
    return enviarResend(resendKey, args);
  console.warn("Sin BREVO_API_KEY ni RESEND_API_KEY; se omite el correo.");
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
): Promise<boolean> {
  const sender = parseFrom(FROM);
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

// ── Resend (respaldo) ───────────────────────────────────────
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
