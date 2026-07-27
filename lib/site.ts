// ============================================================
// CONFIGURACIÓN CENTRAL DEL SITIO — Magic Collinn
// Edita aquí los datos del hotel. Es la única fuente de verdad
// para textos de contacto, SEO, navegación, amenidades y FAQ.
// Los campos marcados con TODO esperan el dato real del hotel.
// ============================================================

export const site = {
  name: "Magic Collinn",
  // Nombre completo de marca para títulos/Schema
  legalName: "Hotel Magic Collinn",
  tagline: "Descanso honesto en el corazón de la Huasteca",
  // Dominio: se usa para metadataBase, sitemap y Open Graph.
  // www es la URL canónica (el apex hotelmagicollinn.com reenvía 301 a www).
  url: "https://www.hotelmagicollinn.com",
  locality: "Axtla de Terrazas",
  region: "San Luis Potosí",
  regionCode: "SLP",
  country: "MX",

  // ── Contacto ──────────────────────────────────────────────
  // WhatsApp en formato internacional sin signos (para wa.me)
  whatsapp: "524811009939", // Confirmado por el dueño (mismo número de reservación)
  phone: "+52 481 100 9939", // Confirmado por Google y sitio actual
  email: "reservas@hotelmagicollinn.com", // TODO: correo real

  // ── Ubicación ─────────────────────────────────────────────
  address: {
    street: "C. José María Morelos 14, Zona Centro", // Confirmado por Google
    locality: "Axtla de Terrazas",
    region: "San Luis Potosí",
    postalCode: "79932", // Confirmado por Google
    country: "MX",
  },
  // Coordenadas sobre la calle José María Morelos, Zona Centro (geocodificado)
  geo: { lat: 21.4381, lng: -98.8676 },
  // Embed de Google Maps por nombre del negocio (Google centra el pin en el hotel real)
  mapEmbedSrc:
    "https://www.google.com/maps?q=Hotel+Magic+Collinn,+Axtla+de+Terrazas&z=16&hl=es&output=embed",

  // ── Operación ─────────────────────────────────────────────
  checkIn: "15:00", // Confirmado por el dueño
  checkOut: "12:00", // Confirmado por el dueño
  petsAllowed: false as boolean | null, // Confirmado: no se reciben mascotas
  rooms: 6,
  roomCategories: 2, // 6 habitaciones repartidas en 2 categorías (sencilla y doble)
  priceRange: "$$", // para Schema LodgingBusiness

  // ── Políticas y confianza (datos confirmados por el hotel) ─
  cancelacion: "Cancela hasta 72 horas antes con reembolso o cambio de fechas.",
  pagos: ["Efectivo", "Tarjeta", "Transferencia", "Pago en OXXO"],
  mejorPrecio: "Mejor precio garantizado al reservar directo, sin comisiones.",

  // ── Reseñas reales (Google) ───────────────────────────────
  googleReviewsUrl: "https://share.google/YkEaMJQmjkAdUKOqq",
  reviewsRating: "4.5", // Calificación real de Google (jun 2026)
  reviewsTotal: 122, // Total real de opiniones en Google

  // ── Redes sociales ────────────────────────────────────────
  // Al llenar una URL se agrega sola al Schema (sameAs). Vacío = se omite.
  socials: {
    facebook: "", // TODO: URL de la página de Facebook del hotel
    instagram: "", // TODO: URL del Instagram del hotel
  },

  // ── Analytics ─────────────────────────────────────────────
  // GA4 del hotel. La env NEXT_PUBLIC_GA_ID (si se define) tiene prioridad;
  // si no, se usa este ID por defecto. El ID de medición es público.
  gaId: process.env.NEXT_PUBLIC_GA_ID || "G-KK9ZZMZXE8",

  // ── Navegación ────────────────────────────────────────────
  // Sin "Inicio": el logo ya lleva al home (6 items + CTA desbordan en md).
  nav: [
    { label: "Habitaciones", href: "/habitaciones" },
    { label: "Galería", href: "/galeria" },
    { label: "Qué hacer", href: "/blog/que-hacer-en-axtla-de-terrazas" },
    { label: "Blog", href: "/blog" },
    { label: "Nosotros", href: "/nosotros" },
    { label: "Contacto", href: "/contacto" },
  ],
} as const;

// Mensaje pre-rellenado para el botón de WhatsApp
export function waLink(message?: string): string {
  const base = `https://wa.me/${site.whatsapp}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

// ── Amenidades del hotel (Inicio) ───────────────────────────
export const amenities = [
  {
    icon: "Snowflake",
    title: "Aire acondicionado",
    desc: "Todas las habitaciones climatizadas para tu descanso.",
  },
  {
    icon: "Car",
    title: "Estacionamiento",
    desc: "Estacionamiento sin costo para huéspedes.",
  },
  {
    icon: "MapPin",
    title: "Ubicación céntrica",
    desc: "A pasos del centro de Axtla de Terrazas.",
  },
  {
    icon: "HeartHandshake",
    title: "Atención personalizada",
    desc: "Atención cercana y servicio que nos distingue.",
  },
] as const;

// ── FAQ (Inicio) ────────────────────────────────────────────
export const faqs = [
  {
    q: "¿Dónde está el Hotel Magic Collinn?",
    a: `Estamos en ${site.address.street}, ${site.address.locality}, ${site.address.region} (C.P. ${site.address.postalCode}), a una calle de la plaza principal, en pleno centro del pueblo.`,
  },
  {
    q: "¿Sirve como base para visitar la Huasteca Potosina?",
    a: "Sí. Axtla de Terrazas está en el corazón de la Huasteca Potosina: desde el hotel puedes salir en el día a cascadas, pozas y ríos cercanos y regresar a dormir al centro. En nuestro blog tenemos guías de qué hacer y cómo llegar.",
  },
  {
    q: "¿Incluye estacionamiento?",
    a: "Sí, contamos con estacionamiento sin costo para nuestros huéspedes.",
  },
  {
    q: "¿A qué hora es el check-in y check-out?",
    a: `El check-in es a partir de las ${site.checkIn} h y el check-out hasta las ${site.checkOut} h.`,
  },
  {
    q: "¿Aceptan mascotas?",
    a: "Por el momento no recibimos mascotas en el hotel. Si tienes alguna duda, escríbenos por WhatsApp con gusto.",
  },
  {
    q: "¿Cuál es la política de cancelación?",
    a: "Puedes cancelar hasta 72 horas antes de tu llegada con reembolso o cambio de fechas. Solo avísanos por WhatsApp.",
  },
  {
    q: "¿Qué formas de pago aceptan?",
    a: "Aceptamos efectivo, tarjeta, transferencia y pago en OXXO. El pago se realiza directamente en el hotel.",
  },
  {
    q: "¿Cómo confirmo mi reserva?",
    a: "Reservas directo en el sitio y te confirmamos por WhatsApp en menos de 24 horas. Al reservar directo tienes el mejor precio, sin comisiones.",
  },
] as const;

// ── Señales de confianza (cerca del CTA) — todas verídicas ──────────
export const confianza = [
  "Mejor precio garantizado al reservar directo",
  "Cancela hasta 72 h antes",
  "Confirmación por WhatsApp en menos de 24 h",
] as const;

// ── Reseñas REALES de Google (5/5). Recortadas para caber, sin alterar
//    el sentido. Calificación agregada en site.reviewsRating/Total. ───
export const testimonios = [
  {
    nombre: "Natalia Camro",
    fecha: "Hace un año",
    rating: 5,
    texto: "Excelente lugar para descansar, a una calle de la plaza principal. Las habitaciones cumplen con todos los servicios y están muy limpias. El trato del dueño es impecable, atento y respetuoso. Lo recomiendo plenamente.",
  },
  {
    nombre: "Marcos Méndez",
    fecha: "Hace un año",
    rating: 5,
    texto: "Excelente hotel, céntrico y con toque hogareño. Para los que viajamos seguido es como estar en casa. Muy limpio y muy buena atención. Regresaría con mi familia.",
  },
  {
    nombre: "Alan Santiago",
    fecha: "Hace 2 años",
    rating: 5,
    texto: "Buen lugar para la familia y trato muy amable: los dueños nos mostraron las habitaciones antes de pagar. Bien ubicado y muy seguro. Sin duda regresaría.",
  },
  {
    nombre: "Gersay Vásquez",
    fecha: "Hace un año",
    rating: 5,
    texto: "Excelente ubicación y habitaciones muy limpias. Precios justos por la calidad de los colchones y las instalaciones. Súper recomendable.",
  },
  {
    nombre: "José Martínez",
    fecha: "Hace 7 meses",
    rating: 5,
    texto: "Muy amable recepción, con internet y cable, muy tradicional y bonito. Y el aire acondicionado, todavía mejor, porque Axtla es muy caliente.",
  },
  {
    nombre: "Daniel Figueroa A.",
    fecha: "Hace 7 meses",
    rating: 5,
    texto: "Excelente trato y las habitaciones muy cómodas. En verdad, muy recomendable este hotel.",
  },
  {
    nombre: "Ale HG",
    fecha: "Hace 9 meses",
    rating: 5,
    texto: "Fui por un viaje de trabajo y agradezco que el aire acondicionado funcione muy bien, porque hacía mucho calor. Un lugar tranquilo.",
  },
  {
    nombre: "Ivonne Andrea Pérez",
    fecha: "Hace un año",
    rating: 5,
    texto: "La atención es excelente y las habitaciones están muy bien. Mil veces recomendado.",
  },
] as const;
