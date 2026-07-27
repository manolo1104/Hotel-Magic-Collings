// ============================================================
// POST /api/contacto — recibe el formulario de contacto y lo envía
// por correo al hotel (Brevo/Resend vía lib/email/resend.ts).
// Si no hay proveedor de correo configurado responde ok:false y el
// formulario cae al fallback mailto: (nunca se pierde el mensaje).
// ============================================================
import { correosActivos, enviarEmail } from "@/lib/email/resend";
import { chip, fila, layout, tablaResumen } from "@/lib/email/templates";
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

  const inner = `
${chip("Mensaje del sitio", "rio")}
<h1 style="font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:600;margin:18px 0 6px;color:#23281F;">Nuevo mensaje desde la web</h1>
${tablaResumen(
  fila("Nombre", esc(nombre)) +
    fila(
      "WhatsApp",
      `<a href="https://wa.me/${esc(whatsapp).replace(/[^0-9]/g, "")}" style="color:#B75C38;">${esc(whatsapp)}</a>`,
    ),
)}
<p style="font-size:14px;line-height:1.65;color:#4a4d40;margin:0;white-space:pre-wrap;">${esc(mensaje)}</p>`;
  const html = layout(`Mensaje de ${nombre} desde el sitio web`, inner);

  const enviado = await enviarEmail({
    to,
    subject: `Mensaje de ${nombre} — sitio web ${site.name}`,
    html,
  });

  return Response.json({ ok: enviado });
}
