// ============================================================
// IMÁGENES DEL HOTEL — Magic Collinn
// Fotos REALES del hotel (jun 2026) en public/imagenes/.
// next/image las optimiza en runtime a AVIF/WebP.
// Las portadas de blog usan stock temático de turismo (Unsplash),
// porque ilustran lugares de la Huasteca, no el hotel.
// ============================================================

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

// Mosaico de galería del Inicio (8 fotos variadas: exteriores + habitaciones)
export const galeria = [
  "/imagenes/corredor-arcos.jpg",
  "/imagenes/doble-2.jpg",
  "/imagenes/sencilla-1.jpg",
  "/imagenes/fachada-entrada.jpg",
  "/imagenes/fachada-lateral.jpg",
  "/imagenes/doble-5.jpg",
  "/imagenes/entrada-noche.jpg",
  "/imagenes/doble-estancia.jpg",
];

// Fotos extra por tipo que NO están en la BD (la BD se sembró una sola vez).
// Se unen en render en /habitaciones para no tocar datos de producción.
export const fotosExtraPorSlug: Record<string, string[]> = {
  doble: [
    "/imagenes/doble-4.jpg",
    "/imagenes/doble-6.jpg",
    "/imagenes/doble-estancia.jpg",
  ],
};
