// ============================================================
// COMPROBACIONES DE LAS TEMPORADAS —  npm run test:temporadas
// El proyecto no tiene framework de pruebas; esto es un script suelto que
// recorre la aritmética de precios, que es la que mueve dinero: prioridad
// entre temporadas, redondeo, noches que entran y noches que no.
// No toca la base de datos.
// ============================================================
import { desglosarEstancia, nochesDe, precioDeNoche } from "./temporadas-calc";
import type { Temporada } from "./temporadas-calc";

const T = (p: Partial<Temporada>): Temporada => ({
  id: Math.random().toString(36).slice(2),
  nombre: "T", desde: "2026-10-31", hasta: "2026-11-02",
  roomTypeId: null, tipoAjuste: "porcentaje", valor: 20, activa: true, ...p,
});

let fallos = 0;
function comprobar(titulo: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? "✅" : "❌"} ${titulo}${ok ? "" : `  → ${JSON.stringify(real)} ≠ ${JSON.stringify(esperado)}`}`);
}

// Noches: llegada incluida, salida excluida.
comprobar("3 noches del 10 al 13", nochesDe("2026-01-10", "2026-01-13"), ["2026-01-10", "2026-01-11", "2026-01-12"]);
comprobar("cruza fin de mes", nochesDe("2026-10-31", "2026-11-02"), ["2026-10-31", "2026-11-01"]);
comprobar("checkout igual a checkin = 0 noches", nochesDe("2026-01-10", "2026-01-10").length, 0);

// Sin temporadas = lo de siempre.
comprobar("sin temporadas: 2 × 1200", desglosarEstancia(1200, "dq", "2026-06-01", "2026-06-03", []).total, 2400);

// Porcentaje y precio fijo.
comprobar("+20% sobre 1200", precioDeNoche(1200, T({ valor: 20 })), 1440);
comprobar("-15% sobre 1200", precioDeNoche(1200, T({ valor: -15 })), 1020);
comprobar("precio fijo gana a la tarifa", precioDeNoche(1200, T({ tipoAjuste: "precio", valor: 1800 })), 1800);
comprobar("nunca baja de $1", precioDeNoche(1200, T({ valor: -90 })), 120);

// La temporada solo toca SUS noches (hasta es inclusive).
const xantolo = T({ nombre: "Xantolo", desde: "2026-10-31", hasta: "2026-11-01", valor: 50 });
const d = desglosarEstancia(1000, "dq", "2026-10-30", "2026-11-03", [xantolo]);
comprobar("3 noches normales + 2 de Xantolo", d.porNoche.map((n) => n.precio), [1000, 1500, 1500, 1000]);
comprobar("total mezclado", d.total, 5000);
comprobar("se marca como mixto", d.mixto, true);
comprobar("nombra la temporada", d.temporadas, ["Xantolo"]);
comprobar("promedio por noche", d.precioNoche, 1250);

// Prioridad: la de categoría le gana a la general, y NO se enciman.
const general = T({ nombre: "General", valor: 10, roomTypeId: null });
const soloDQ = T({ nombre: "Solo DQ", valor: 50, roomTypeId: "dq" });
comprobar("categoría gana a general", desglosarEstancia(1000, "dq", "2026-10-31", "2026-11-01", [soloDQ, general]).total, 1500);
comprobar("otra categoría usa la general", desglosarEstancia(1000, "ks", "2026-10-31", "2026-11-01", [soloDQ, general]).total, 1100);
comprobar("no se acumulan los dos ajustes", desglosarEstancia(1000, "dq", "2026-10-31", "2026-11-01", [soloDQ, general]).total !== 1650, true);

// Una apagada no cobra.
comprobar("temporada apagada se ignora", desglosarEstancia(1000, "dq", "2026-10-31", "2026-11-01", [T({ valor: 99, activa: false })]).total, 1000);

// Entre dos del mismo alcance manda la primera de la lista (la más reciente).
comprobar("empate: gana la más reciente", desglosarEstancia(1000, "dq", "2026-10-31", "2026-11-01", [T({ nombre: "nueva", valor: 30 }), T({ nombre: "vieja", valor: 80 })]).temporadas, ["nueva"]);

console.log(fallos === 0 ? "\nTodo correcto." : `\n${fallos} comprobaciones fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
