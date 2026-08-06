// ============================================================
// DATOS SEMILLA — tipos de habitación y cuartos físicos
// Imports RELATIVOS a propósito (compatibles con tsx/seed).
//
// TARIFAS REALES confirmadas por Gersay el 31 jul 2026.
//
// El hotel cobra POR OCUPACIÓN: la misma habitación cuesta distinto según
// cuánta gente entra. Por eso `precios` va indexado por número de huéspedes
// (posición 0 = 1 persona) y `tarifaBase` es solo el precio "desde", que es lo
// que se muestra donde todavía no se sabe cuánta gente viene.
//
//              1 persona   2 personas  3 personas  4 personas
//   Matrimonial   $720        $840          —           —
//   King Size     $900      $1,080          —           —
//   Doble Queen $1,200      $1,200      $1,320      $1,440
//   Depa Queen    $900      $1,080          —           —
//   Depa Matrim $1,020      $1,020      $1,140      $1,260
//
// ⚠️ FALTA CONFIRMAR CON GERSAY antes de sembrar esto en producción:
//   · cuántas habitaciones FÍSICAS hay de cada tipo (campo `units`)
//   · si el departamento se puede rentar completo (6 personas) y a qué precio
//   · fotos propias de cada tipo (hoy se reutilizan las que ya había)
// Además, él avisó que la opción Matrimonial desaparece en ~1 semana y que en
// 3–4 semanas habrá camas individuales en algunas King/Queen.
// ============================================================
import { sencillaFotos, dobleFotos } from "../images";

export interface RoomTypeSeed {
  slug: string;
  nombre: string;
  descripcion: string;
  capacidad: number;
  tarifaBase: number; // MXN por noche, precio "desde" (1 persona)
  precios: number[]; // MXN por noche según ocupación (índice 0 = 1 persona)
  amenidades: string[];
  fotos: string[];
  units: string[]; // números de cuarto físicos
}

// Amenidades que Gersay confirmó para todas las habitaciones.
const AMENIDADES_BASE = [
  "Aire acondicionado",
  "WiFi satelital de alta velocidad",
  "TV con IPTV (300+ canales y 10,000 títulos)",
  "Agua caliente",
  "Baño privado",
  "Estacionamiento",
];

export const roomTypeSeed: RoomTypeSeed[] = [
  {
    slug: "matrimonial",
    nombre: "Habitación Matrimonial",
    descripcion:
      "Una cama matrimonial para dos personas, climatizada y a pasos del centro de Axtla. La opción más sencilla para una escapada corta o un viaje de trabajo.",
    capacidad: 2,
    tarifaBase: 720,
    precios: [720, 840],
    amenidades: AMENIDADES_BASE,
    fotos: sencillaFotos,
    units: [], // ⚠️ pendiente: cuántas hay
  },
  {
    slug: "king-size",
    nombre: "Habitación King Size",
    descripcion:
      "Cama King Size para dos personas, con aire acondicionado, agua caliente y pantalla con IPTV. Espacio de sobra para descansar de verdad después de un día en la Huasteca.",
    capacidad: 2,
    tarifaBase: 900,
    precios: [900, 1080],
    amenidades: AMENIDADES_BASE,
    fotos: sencillaFotos,
    units: [], // ⚠️ pendiente: cuántas hay
  },
  {
    slug: "doble-queen",
    nombre: "Habitación Doble Queen",
    descripcion:
      "Dos camas Queen Size para hasta cuatro personas. La favorita de familias y grupos de amigos que recorren cascadas todo el día y quieren volver a dormir cómodos y céntricos.",
    capacidad: 4,
    tarifaBase: 1200,
    precios: [1200, 1200, 1320, 1440],
    amenidades: AMENIDADES_BASE,
    fotos: dobleFotos,
    units: [], // ⚠️ pendiente: cuántas hay
  },
  {
    slug: "depa-queen",
    nombre: "Departamento · habitación Queen",
    descripcion:
      "La habitación con cama Queen Size del departamento, para dos personas. Se renta por separado y comparte la comodidad y el espacio extra del departamento.",
    capacidad: 2,
    tarifaBase: 900,
    precios: [900, 1080],
    amenidades: AMENIDADES_BASE,
    fotos: dobleFotos,
    units: [], // ⚠️ pendiente: cuántas hay
  },
  {
    slug: "depa-matrimonial",
    nombre: "Departamento · habitación con 2 camas matrimoniales",
    descripcion:
      "La habitación con dos camas matrimoniales del departamento, para hasta cuatro personas. Ideal para dos parejas o una familia que quiere estar junta sin apretarse.",
    capacidad: 4,
    tarifaBase: 1020,
    precios: [1020, 1020, 1140, 1260],
    amenidades: AMENIDADES_BASE,
    fotos: dobleFotos,
    units: [], // ⚠️ pendiente: cuántas hay
  },
  {
    // CUARTO INTERNO DE PRUEBA — $10 MXN. Sirve para probar el cobro REAL de
    // Mercado Pago sin gastar. OCULTO del sitio público (ver HIDDEN_SLUGS en
    // engine.ts); se reserva solo por link directo:
    //   /reservar?tipo=prueba&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&huespedes=1
    slug: "prueba",
    nombre: "Reserva de prueba (interno)",
    descripcion:
      "Cuarto interno de $10 para probar el cobro real de Mercado Pago. No es una habitación real y no aparece en el sitio público.",
    capacidad: 2,
    tarifaBase: 10,
    precios: [10, 10],
    amenidades: ["Uso interno"],
    fotos: sencillaFotos,
    units: ["T01"],
  },
];
