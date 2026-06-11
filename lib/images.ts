// ============================================================
// IMÁGENES DE STOCK (provisionales) — Magic Collinn
// TODO: reemplazar TODAS por fotos reales del hotel cuando estén.
// Fuente: Unsplash (verificadas 200). Centralizadas aquí para
// cambiarlas en un solo lugar.
// ============================================================

const UNSPLASH = "https://images.unsplash.com";

/** Construye una URL de Unsplash con ancho y calidad. */
export function img(id: string, w = 1200, q = 80): string {
  return `${UNSPLASH}/${id}?auto=format&fit=crop&w=${w}&q=${q}`;
}

// Fondo del hero (atmosférico, soporta overlay oscuro)
export const heroImage = img("photo-1566073771259-6a8506099945", 2000, 75);

// Galerías por tipo de habitación (la 1ª es la portada)
export const sencillaFotos = [
  img("photo-1611892440504-42a792e24d32"),
  img("photo-1505693416388-ac5ce068fe85"),
  img("photo-1551882547-ff40c63fe5fa"),
];

export const dobleFotos = [
  img("photo-1582719478250-c89cae4dc85b"),
  img("photo-1631049307264-da0ec9d70304"),
  img("photo-1590490360182-c33d57733427"),
];

// Mosaico de galería breve (Inicio): mezcla de hotel + naturaleza Huasteca
export const galeria = [
  img("photo-1564501049412-61c2a3083791", 900),
  img("photo-1542314831-068cd1dbfeeb", 900), // bosque / Huasteca
  img("photo-1571896349842-33c89424de2d", 900),
  img("photo-1520250497591-112f2f40a3f4", 900),
  img("photo-1455587734955-081b22074882", 900),
  img("photo-1618773928121-c32242e63f39", 900),
];

// Portadas para los posts del blog (seed)
export const blogCovers = {
  "que-hacer-en-axtla-de-terrazas": img("photo-1542314831-068cd1dbfeeb", 1600),
  "como-llegar-a-axtla-de-terrazas": img("photo-1571003123894-1f0594d2b5d9", 1600),
};
