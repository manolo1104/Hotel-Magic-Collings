// ============================================================
// POST /api/contacto — recibe el formulario de contacto y lo envía
// por correo al hotel (Brevo/Resend vía lib/email/resend.ts).
// Si no hay proveedor de correo configurado responde ok:false y el
// formulario cae al fallback mailto: (nunca se pierde el mensaje).
// ============================================================
import { correosActivos, enviarEmail } from "@/lib/email/resend";
import { site } from "@/lib/site";

const MAX = { nombre: 120, whatsapp: 40, mensaje: 4000 };

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const nombre = String(body.nombre ?? "").trim();
  const whatsapp = String(body.whatsapp ?? "").trim();
  const mensaje = String(body.mensaje ?? "").trim();
  const honeypot = String(body.empresa ?? "").trim();

  // Bot detectado (honeypot lleno): descartar en silencio con "éxito"
  // para no darle pistas (mismo criterio que el formulario).
  if (honeypot) return Response.json({ ok: true });

  if (!nombre || !whatsapp || !mensaje) {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (
    nombre.length > MAX.nombre ||
    whatsapp.length > MAX.whatsapp ||
    mensaje.length > MAX.mensaje
  ) {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (!correosActivos()) return Response.json({ ok: false });

  // Bandeja del hotel: CONTACT_TO > OWNER_EMAIL > correo público del sitio.
  const to = process.env.CONTACT_TO || process.env.OWNER_EMAIL || site.email;

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.6">
      <h2 style="margin:0 0 12px">Nuevo mensaje desde el sitio web</h2>
      <p><strong>Nombre:</strong> ${esc(nombre)}</p>
      <p><strong>WhatsApp:</strong> ${esc(whatsapp)}</p>
      <p style="white-space:pre-wrap"><strong>Mensaje:</strong><br/>${esc(mensaje)}</p>
    </div>`;

  const enviado = await enviarEmail({
    to,
    subject: `Mensaje de ${nombre} — sitio web ${site.name}`,
    html,
  });

  return Response.json({ ok: enviado });
}
