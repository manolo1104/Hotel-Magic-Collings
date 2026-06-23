// ============================================================
// Configuración de limpieza y mantenimiento (puro)
// Magic Collinn: 6 cuartos iguales (sin piscina/jacuzzi).
// ============================================================
export interface ChecklistItem {
  id: string;
  label: string;
  categoria: "habitacion" | "bano" | "amenidades";
}

export const BASE_ITEMS: ChecklistItem[] = [
  { id: "camas", label: "Tender camas y cambiar sábanas", categoria: "habitacion" },
  { id: "pisos", label: "Barrer y trapear pisos", categoria: "habitacion" },
  { id: "polvo", label: "Quitar polvo de muebles y superficies", categoria: "habitacion" },
  { id: "basura", label: "Vaciar botes de basura", categoria: "habitacion" },
  { id: "ventanas", label: "Limpiar ventanas, espejos y cortinas", categoria: "habitacion" },
  { id: "bano-wc", label: "Limpiar y desinfectar el baño", categoria: "bano" },
  { id: "bano-toallas", label: "Reponer toallas limpias", categoria: "bano" },
  { id: "bano-amenidades", label: "Reponer jabón y papel", categoria: "bano" },
  { id: "ac", label: "Revisar aire acondicionado", categoria: "amenidades" },
  { id: "tv", label: "Revisar TV y control", categoria: "amenidades" },
  { id: "wifi", label: "Verificar WiFi", categoria: "amenidades" },
  { id: "revision", label: "Revisión final (olores y detalles)", categoria: "habitacion" },
];

/** Items del checklist para un cuarto (todos iguales en MC). */
export function getChecklistItems(): ChecklistItem[] {
  return BASE_ITEMS;
}

export interface MaintSeed {
  ambito: string; // 'hotel' o número de cuarto
  tarea: string;
  frecuenciaDias: number;
}

// Tareas de mantenimiento que se siembran la primera vez (proximaVez = hoy).
export function maintenanceSeed(roomNumbers: string[]): MaintSeed[] {
  const hotel: MaintSeed[] = [
    { ambito: "hotel", tarea: "Fumigación general", frecuenciaDias: 30 },
    { ambito: "hotel", tarea: "Revisión eléctrica e iluminación", frecuenciaDias: 90 },
    { ambito: "hotel", tarea: "Revisión de tinacos y bombas de agua", frecuenciaDias: 60 },
    { ambito: "hotel", tarea: "Mantenimiento del router / WiFi", frecuenciaDias: 90 },
    { ambito: "hotel", tarea: "Revisión de extintores", frecuenciaDias: 180 },
  ];
  const acPorCuarto: MaintSeed[] = roomNumbers.map((n) => ({
    ambito: n,
    tarea: "Servicio de aire acondicionado",
    frecuenciaDias: 90,
  }));
  return [...hotel, ...acPorCuarto];
}
