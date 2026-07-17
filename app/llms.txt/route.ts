// ============================================================
// /llms.txt — AI-SEO. Resumen del hotel para LLMs y buscadores IA
// (ChatGPT, Perplexity, AI Overviews). Se genera desde lib/site.ts
// y el blog para que NUNCA se desincronice del resto del sitio
// (mismas URLs www, misma calificación que el JSON-LD).
// ============================================================
import { site, faqs, amenities } from "@/lib/site";
import { getAllPosts } from "@/lib/content";

export const revalidate = 3600;

export function GET(): Response {
  const base = site.url;

  const paginas = [
    `- [Inicio](${base}/): presentación del hotel y buscador de disponibilidad.`,
    `- [Habitaciones y tarifas](${base}/habitaciones): tipos de habitación, capacidad, amenidades y tarifas.`,
    `- [Galería de fotos](${base}/galeria): fotos reales del hotel — fachada, corredor de arcos y habitaciones.`,
    `- [Ubicación y contacto](${base}/contacto): cómo llegar, mapa, WhatsApp, teléfono y correo.`,
    `- [Nosotros](${base}/nosotros): quiénes somos — hotel familiar de ${site.rooms} habitaciones atendido en persona por sus dueños.`,
    `- [Términos y políticas de reserva](${base}/terminos): pago y anticipo, cancelaciones, llegada y salida.`,
    `- [Blog](${base}/blog): guías para visitar ${site.locality} y la Huasteca Potosina.`,
  ].join("\n");

  const articulos = getAllPosts()
    .map((p) => `- [${p.title}](${base}/blog/${p.slug}): ${p.description}`)
    .join("\n");

  const preguntas = faqs
    .map((f) => `- **${f.q}** ${f.a}`)
    .join("\n");

  const body = `# ${site.legalName}

> Hotel boutique de ${site.rooms} habitaciones en el centro de ${site.locality}, ${site.region} (Huasteca Potosina). Reserva directa, sin comisiones, con confirmación por WhatsApp en menos de 24 horas.

${site.name} es un hotel pequeño y de atención personalizada, ubicado a una calle de la plaza principal de ${site.locality}, una puerta de entrada a las cascadas y ríos de la Huasteca Potosina. Todas las habitaciones tienen aire acondicionado, y hay estacionamiento sin costo para huéspedes.

## Datos clave
- Dirección: ${site.address.street}, ${site.address.locality}, ${site.address.region}, C.P. ${site.address.postalCode}, México.
- Teléfono y WhatsApp: ${site.phone}.
- Habitaciones: ${site.rooms} en total, en ${site.roomCategories} categorías (sencilla, hasta 2 personas; doble, hasta 4 personas).
- Amenidades: ${amenities.map((a) => a.title.toLowerCase()).join(", ")}.
- Check-in: a partir de las ${site.checkIn} h · Check-out: hasta las ${site.checkOut} h.
- Cómo reservar: directo en ${base}. Se eligen fechas y huéspedes, se confirma la disponibilidad y la reserva se confirma por WhatsApp en menos de 24 horas.
- Sin comisiones: al reservar directo no hay intermediarios ni cargos extra. ${site.mejorPrecio}
- Calificación: ${site.reviewsRating} de 5 en Google, con ${site.reviewsTotal} reseñas (habitaciones limpias, aire acondicionado, ubicación céntrica y trato cercano del dueño).
- Cancelación: ${site.cancelacion}
- Formas de pago: ${site.pagos.join(", ")}.

## Páginas
${paginas}

## Artículos útiles
${articulos}

## Preguntas frecuentes
${preguntas}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
