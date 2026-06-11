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
  tagline: "Hotel boutique en el corazón de Axtla de Terrazas",
  // Dominio (confirmar): se usa para metadataBase, sitemap y Open Graph
  url: "https://hotelmagicollinn.com", // TODO: confirmar dominio real
  locality: "Axtla de Terrazas",
  region: "San Luis Potosí",
  regionCode: "SLP",
  country: "MX",

  // ── Contacto ──────────────────────────────────────────────
  // WhatsApp en formato internacional sin signos (para wa.me)
  whatsapp: "524800000000", // TODO: número real de WhatsApp
  phone: "+52 480 000 0000", // TODO: teléfono real
  email: "reservas@hotelmagicollinn.com", // TODO: correo real

  // ── Ubicación ─────────────────────────────────────────────
  address: {
    street: "Centro de Axtla de Terrazas", // TODO: calle y número exactos
    locality: "Axtla de Terrazas",
    region: "San Luis Potosí",
    postalCode: "79930", // TODO: confirmar C.P.
    country: "MX",
  },
  // Coordenadas para el mapa y Schema (TODO: coords exactas del hotel)
  geo: { lat: 21.4347, lng: -98.8786 },
  // URL de embed de Google Maps (TODO: pegar el src del iframe real)
  mapEmbedSrc: "",

  // ── Operación ─────────────────────────────────────────────
  checkIn: "15:00", // TODO: confirmar
  checkOut: "12:00", // TODO: confirmar
  petsAllowed: null as boolean | null, // TODO: definir política de mascotas
  rooms: 6,
  priceRange: "$$", // para Schema LodgingBusiness

  // ── Analytics ─────────────────────────────────────────────
  gaId: "", // TODO: GA_ID

  // ── Navegación ────────────────────────────────────────────
  nav: [
    { label: "Inicio", href: "/" },
    { label: "Habitaciones", href: "/habitaciones" },
    { label: "Blog", href: "/blog" },
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
    q: "¿Incluye estacionamiento?",
    a: "Sí, contamos con estacionamiento sin costo para nuestros huéspedes.",
  },
  {
    q: "¿A qué hora es el check-in y check-out?",
    a: `El check-in es a partir de las ${site.checkIn} h y el check-out hasta las ${site.checkOut} h.`, // TODO: confirmar horarios
  },
  {
    q: "¿Aceptan mascotas?",
    a: "Escríbenos por WhatsApp para confirmar la disponibilidad para tu mascota.", // TODO: definir política
  },
  {
    q: "¿Cómo confirmo mi reserva?",
    a: "Reservas directo en el sitio y te confirmamos por WhatsApp en menos de 24 horas.",
  },
] as const;

// ── Señales de confianza (cerca del CTA) — todas verídicas ──────────
export const confianza = [
  "Sin pago en línea, pagas en el hotel",
  "Confirmación por WhatsApp en menos de 24 h",
  "Reserva directa, sin comisiones",
] as const;

// ── Reseñas ─────────────────────────────────────────────────────────
// ⚠️ EJEMPLO: reemplaza estos textos por reseñas REALES (Google, etc.).
// No inventamos calificación numérica ni fotos de huéspedes.
export const testimonios = [
  {
    nombre: "María Fernanda G.",
    origen: "Viaje familiar",
    texto: "Un lugar muy limpio y la atención de primera. Nos sentimos como en casa y el centro queda a un par de cuadras.",
  },
  {
    nombre: "Jorge Ramírez",
    origen: "Estancia de trabajo",
    texto: "Perfecto para una noche de paso. El estacionamiento y el aire acondicionado se agradecen muchísimo con el calor de la Huasteca.",
  },
  {
    nombre: "Lucía Hernández",
    origen: "Escapada de fin de semana",
    texto: "Reservé directo por WhatsApp y me confirmaron rapidísimo. Excelente punto de partida para conocer las cascadas.",
  },
] as const;
