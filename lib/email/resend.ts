// ============================================================
// CLIENTE DE CORREO (Resend) — solo servidor
// Si RESEND_API_KEY no está configurada, se omite el envío sin romper nada
// (best-effort). Patrón tomado de Kora (lib/email/resend.ts).
// ============================================================
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
// Mientras no haya dominio verificado, Resend permite enviar desde su dominio
// de pruebas (onboarding@resend.dev). En producción: dominio del hotel.
const FROM = process.env.RESEND_FROM || "Magic Collinn <onboarding@resend.dev>";

/** ¿Está configurado el envío de correos? */
export function correosActivos(): boolean {
  return Boolean(apiKey && apiKey.trim().length > 0);
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
}

export async function enviarEmail(args: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<boolean> {
  if (!apiKey) {
    console.warn("RESEND_API_KEY no configurada; se omite el correo.");
    return false;
  }
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
