// ============================================================
// IMÁGENES DEL HOTEL — Magic Collinn
// Fotos REALES del hotel en public/imagenes/.
// next/image las optimiza en runtime a AVIF/WebP.
//
// Las galerías por tipo vienen de las fotos que mandó Gersay el 31 jul 2026,
// clasificadas por lo que se ve en cada una:
//   · King Size  → una cama king con sábana negra, pared amarilla
//   · Matrimonial→ una cama con almohadas rojas y colcha blanca floral
//   · Doble Queen→ dos camas, pared amarilla
//   · Departamento→ paredes BLANCAS (decoración distinta al resto del hotel)
//
// Las portadas de blog usan stock temático de turismo (Unsplash),
// porque ilustran lugares de la Huasteca, no el hotel.
// ============================================================

// Fondo del hero: fachada del hotel con jardín y cielo abierto
export const heroImage = "/imagenes/fachada-jardin.jpg";

// ── Galerías por tipo de habitación ─────────────────────────
// La primera de cada lista es la portada en /habitaciones.

export const matrimonialFotos = [
  "/imagenes/matrimonial-1.jpg",
  "/imagenes/matrimonial-2.jpg",
  "/imagenes/matrimonial-3.jpg",
];

export const kingFotos = [
  "/imagenes/king-2.jpg", // la más amplia: cama king, salita y balcón
  "/imagenes/king-1.jpg",
  "/imagenes/king-3.jpg",
];

export const dobleQueenFotos = [
  "/imagenes/doble-queen-2.jpg", // portada: se ven las dos camas completas
  "/imagenes/doble-queen-1.jpg",
  "/imagenes/doble-queen-3.jpg",
  "/imagenes/doble-queen-4.jpg",
  "/imagenes/doble-queen-5.jpg",
  "/imagenes/doble-queen-6.jpg",
  "/imagenes/doble-queen-7.jpg",
  "/imagenes/doble-queen-8.jpg",
];

// La Suite es el departamento COMPLETO (Gersay lo corrigió el 7 ago 2026: ya no
// se renta por recámaras separadas). Estas 4 fotos son sus dos recámaras.
export const suiteFotos = [
  "/imagenes/depa-matrimonial-2.jpg", // portada: la recámara de 2 matrimoniales
  "/imagenes/depa-matrimonial-1.jpg",
  "/imagenes/depa-queen-2.jpg", // la recámara con cama Queen
  "/imagenes/depa-queen-1.jpg",
];

// Galerías del inventario ANTERIOR (2 tipos). Se conservan porque la base de
// producción todavía las referencia hasta correr `npm run db:tarifas`.
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
  "/imagenes/corredor-arcos-jardin.jpg",
  "/imagenes/doble-queen-2.jpg",
  "/imagenes/king-2.jpg",
  "/imagenes/porche-plantas.jpg",
  "/imagenes/fachada-esquina.jpg",
  "/imagenes/matrimonial-1.jpg",
  "/imagenes/patio-empedrado.jpg",
  "/imagenes/corredor-habitaciones.jpg",
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
