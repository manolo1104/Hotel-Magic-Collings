// ============================================================
// IMÁGENES DEL HOTEL — Magic Collinn
// Fotos REALES del hotel (jun 2026) en public/imagenes/.
// next/image las optimiza en runtime a AVIF/WebP.
// Las portadas de blog usan stock temático de turismo (Unsplash),
// porque ilustran lugares de la Huasteca, no el hotel.
// ============================================================

const UNSPLASH = "https://images.unsplash.com";

/** URL de Unsplash con ancho y calidad. Solo para portadas de blog (turismo). */
export function img(id: string, w = 1200, q = 80): string {
  return `${UNSPLASH}/${id}?auto=format&fit=crop&w=${w}&q=${q}`;
}

// Fondo del hero: fachada del hotel con jardín y cielo abierto
export const heroImage = "/imagenes/fachada-jardin.jpg";

// Galerías por tipo de habitación (la 1ª es la portada en /habitaciones)
export const sencillaFotos = [
  "/imagenes/sencilla-1.jpg",
  "/imagenes/sencilla-2.jpg",
  "/imagenes/sencilla-3.jpg",
];

export const dobleFotos = [
  "/imagenes/doble-1.jpg",
  "/imagenes/doble-2.jpg",
  "/imagenes/doble-3.jpg",
];

// Mosaico de galería del Inicio (6 fotos variadas: exteriores + habitaciones)
export const galeria = [
  "/imagenes/corredor-arcos.jpg",
  "/imagenes/doble-2.jpg",
  "/imagenes/sencilla-1.jpg",
  "/imagenes/fachada-entrada.jpg",
  "/imagenes/fachada-lateral.jpg",
  "/imagenes/doble-5.jpg",
];

// Portadas para los posts del blog (turismo Huasteca) — stock temático
export const blogCovers = {
  "que-hacer-en-axtla-de-terrazas": img("photo-1542314831-068cd1dbfeeb", 1600),
  "como-llegar-a-axtla-de-terrazas": img("photo-1571003123894-1f0594d2b5d9", 1600),
};
