// ============================================================
// DATOS SEMILLA — 2 tipos de habitación + 6 cuartos físicos
// Imports RELATIVOS a propósito (compatibles con tsx/seed).
// TODO: tarifas reales por noche.
// ============================================================
import { sencillaFotos, dobleFotos } from "../images";

export interface RoomTypeSeed {
  slug: string;
  nombre: string;
  descripcion: string;
  capacidad: number;
  tarifaBase: number;
  amenidades: string[];
  fotos: string[];
  units: string[]; // números de cuarto físicos
}

export const roomTypeSeed: RoomTypeSeed[] = [
  {
    slug: "sencilla",
    nombre: "Habitación Sencilla",
    descripcion:
      "Acogedora habitación para una o dos personas, climatizada y con lo esencial para descansar a pasos del centro de Axtla. Ideal para viajes de trabajo o escapadas cortas.",
    capacidad: 2,
    tarifaBase: 850, // TODO: tarifa real por noche (MXN)
    amenidades: [
      "Aire acondicionado",
      "WiFi",
      "Baño privado",
      "TV",
      "Estacionamiento",
    ],
    fotos: sencillaFotos,
    units: ["101", "102", "103"],
  },
  {
    slug: "doble",
    nombre: "Habitación Doble",
    descripcion:
      "Habitación amplia para hasta cuatro personas, perfecta para familias o grupos. Climatizada, céntrica y pensada para que todos descansen cómodos.",
    capacidad: 4,
    tarifaBase: 1200, // TODO: tarifa real por noche (MXN)
    amenidades: [
      "Aire acondicionado",
      "WiFi",
      "Baño privado",
      "TV",
      "Estacionamiento",
      "Espacio para familia",
    ],
    fotos: dobleFotos,
    units: ["201", "202", "203"],
  },
];
