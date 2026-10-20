// ============================================================
// COMPROBACIONES DEL BOT CONTRA UNA BASE DE PRUEBA —  npm run test:bot-db
// Todo el camino del dinero sin llamar a la IA: disponibilidad con el cierre
// por temporada, cotizar, cambiar de fechas, comprobante, confirmar con PIN,
// recordatorios y pausas. Usa un PGlite NUEVO en una carpeta temporal y se
// niega a correr si hay DATABASE_URL (la de .env.local es PRODUCCIÓN).
// ============================================================
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

if (process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL) {
  console.error("🔴 Hay DATABASE_URL en el entorno: esta prueba NO corre contra una base real.");
  process.exit(1);
}
process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "mc-bot-db-"));
process.env.BOT_ADMIN_PIN = "4821";
process.env.BANK_BANCO = "BBVA";
process.env.BANK_CLABE = "012180001234567899"; // falsa con dígito verificador válido
process.env.BANK_TITULAR = "Hotel Prueba";
process.env.ANTHROPIC_API_KEY = "sk-ant-invalida-de-prueba";
delete process.env.RESEND_API_KEY;
delete process.env.BREVO_API_KEY;

let fallos = 0;
function comprobar(titulo: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? "✅" : "❌"} ${titulo}${ok ? "" : `  → ${JSON.stringify(real)} ≠ ${JSON.stringify(esperado)}`}`);
}

async function main() {
  const { ensureDb } = await import("../db/ensure");
  const { db } = await import("../db");
  const { rooms, roomTypes, blocks, bookings, botCotizaciones, botSalida, botMensajes } = await import("../db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { todayISO } = await import("../booking/engine");
  const { consultarDisponibilidad } = await import("./disponibilidad");
  const { crearCotizacion, registrarComprobante, cotizacionPorFolio } = await import("./cotizacion");
  const { ejecutarComando, tomarPendientes, pausar } = await import("./admin");
  const { ejecutarHerramienta } = await import("./herramientas");
  const { procesarTurno, DISCULPA } = await import("./cerebro");
  const { ponerBotActivo } = await import("./config");

  await ensureDb();
  const tipos = await db.select().from(roomTypes);
  const porSlug = new Map(tipos.map((t) => [t.slug, t]));
  for (const [slug, prefijo] of [["king-size", "KS"], ["doble-queen", "DQ"]] as const)
    await db.insert(rooms).values([1, 2, 3].map((n) => ({ roomTypeId: porSlug.get(slug)!.id, numero: `${prefijo}-0${n}` })));
  const todos = await db.select().from(rooms);
  await db.insert(blocks).values(todos.map((r) => ({ roomId: r.id, checkin: todayISO(), checkout: "2027-01-01" })));

  // ── Disponibilidad ──────────────────────────────────────────
  const nov = await consultarDisponibilidad({ checkin: "2026-11-14", checkout: "2026-11-16", huespedes: 2 });
  comprobar("noviembre: sin lugar", nov.ok && nov.hay_lugar, false);
  comprobar("noviembre: avisa el cierre", nov.ok && Boolean(nov.aviso_cierre), true);
  comprobar("noviembre: primera alternativa el 1 ene", nov.ok && nov.fechas_alternativas?.[0]?.checkin, "2027-01-01");
  comprobar("noviembre: la alternativa trae precio", nov.ok && (nov.fechas_alternativas?.[0]?.desde_total ?? 0) > 0, true);

  const ene = await consultarDisponibilidad({ checkin: "2027-01-16", checkout: "2027-01-18", huespedes: 2 });
  const ks = ene.ok ? ene.opciones_un_cuarto.find((o) => o.slug === "king-size") : undefined;
  comprobar("enero: King Size 2 noches × $1,080 = $2,160", ks?.total_estancia, 2160);
  comprobar("enero: 3 King Size libres", ks?.cuartos_libres, 3);
  comprobar("enero: la Matrimonial sin cuartos no aparece", ene.ok && ene.opciones_un_cuarto.some((o) => o.slug === "matrimonial"), false);
  comprobar("enero: el cuarto de prueba no aparece", ene.ok && ene.opciones_un_cuarto.some((o) => o.slug === "prueba"), false);

  const grupo = await consultarDisponibilidad({ checkin: "2027-02-06", checkout: "2027-02-08", huespedes: 9 });
  comprobar("grupo de 9: hay combinaciones", grupo.ok && grupo.opciones_varios_cuartos.length > 0, true);
  comprobar("grupo de 9: la primera usa 2 cuartos", grupo.ok && grupo.opciones_varios_cuartos[0]?.cuartos, 2);

  // ── Cotizar ─────────────────────────────────────────────────
  const A = "5214810000001@c.us";
  const c1 = await crearCotizacion({
    chatId: A, telefono: "524810000001", nombre: "Juan Pérez", checkin: "2027-01-16", checkout: "2027-01-18",
    habitaciones: [{ slug: "king-size", huespedes: 2 }],
  });
  comprobar("cotización creada", c1.ok, true);
  if (!c1.ok) throw new Error(c1.error);
  comprobar("total $2,160, anticipo $1,080", [c1.cotizacion.total, c1.cotizacion.anticipo, c1.cotizacion.saldo], [2160, 1080, 1080]);
  const [b1] = await db.select().from(bookings).where(eq(bookings.id, (c1.cotizacion.habitaciones as { bookingId: string }[])[0].bookingId));
  comprobar("reserva con origen whatsapp", b1.origen, "whatsapp");
  comprobar("reserva apartada (iniciado)", b1.estadoPago, "iniciado");
  const horas = (b1.expiraEn!.getTime() - Date.now()) / 3_600_000;
  comprobar("apartado de ~3 h", horas > 2.9 && horas <= 3, true);
  const ene2 = await consultarDisponibilidad({ checkin: "2027-01-16", checkout: "2027-01-18", huespedes: 2 });
  comprobar("el apartado ocupa un King Size", ene2.ok && ene2.opciones_un_cuarto.find((o) => o.slug === "king-size")?.cuartos_libres, 2);
  comprobar("el resumen trae la CLABE", c1.resumen.includes("012180001234567899"), true);

  // ── Cambio de fechas ────────────────────────────────────────
  const c2 = await crearCotizacion({
    chatId: A, telefono: "524810000001", nombre: "Juan Pérez", checkin: "2027-01-23", checkout: "2027-01-25",
    habitaciones: [{ slug: "king-size", huespedes: 2 }],
  });
  comprobar("la nueva reemplaza a la anterior", c2.ok && c2.reemplazo, c1.cotizacion.folio);
  comprobar("la anterior queda reemplazada", (await cotizacionPorFolio(c1.cotizacion.folio))?.estado, "reemplazada");
  const [b1b] = await db.select().from(bookings).where(eq(bookings.id, b1.id));
  comprobar("su apartado se soltó", b1b.estado, "expirada");
  const ene3 = await consultarDisponibilidad({ checkin: "2027-01-16", checkout: "2027-01-18", huespedes: 2 });
  comprobar("los 3 King Size vuelven a estar libres", ene3.ok && ene3.opciones_un_cuarto.find((o) => o.slug === "king-size")?.cuartos_libres, 3);
  if (!c2.ok) throw new Error(c2.error);

  // Cambio a algo imposible: se queda la anterior intacta.
  const imposible = await crearCotizacion({
    chatId: A, telefono: "524810000001", nombre: "Juan Pérez", checkin: "2026-12-01", checkout: "2026-12-03",
    habitaciones: [{ slug: "king-size", huespedes: 2 }],
  });
  comprobar("cambio a fechas cerradas falla", imposible.ok, false);
  comprobar("…y la cotización vigente sigue apartada", (await cotizacionPorFolio(c2.cotizacion.folio))?.estado, "vigente");
  const idsC2 = (c2.cotizacion.habitaciones as { bookingId: string }[]).map((h) => h.bookingId);
  const reservasC2 = await db.select().from(bookings).where(inArray(bookings.id, idsC2));
  comprobar("…con su reserva en pendiente", reservasC2.map((b) => b.estado), ["pendiente"]);

  // ── Una noche se paga completa ──────────────────────────────
  const c3 = await crearCotizacion({
    chatId: "190000000000004@lid", telefono: "", nombre: "Carlos Ruiz", checkin: "2027-01-23", checkout: "2027-01-24",
    habitaciones: [{ slug: "doble-queen", huespedes: 3 }],
  });
  comprobar("1 noche: anticipo = total", c3.ok && c3.cotizacion.anticipo === c3.cotizacion.total, true);

  // ── Comprobante y confirmación ──────────────────────────────
  const comp = await registrarComprobante(A, "$1,080 MXN ✓");
  comprobar("comprobante registrado", comp.cotizacion?.estado, "comprobante");
  const [b2] = await db.select().from(bookings).where(inArray(bookings.id, idsC2));
  comprobar("apartado alargado a ~24 h", (b2.expiraEn!.getTime() - Date.now()) / 3_600_000 > 23, true);
  comprobar(
    "con comprobante no se puede reemplazar",
    (await crearCotizacion({ chatId: A, telefono: "", nombre: "Juan", checkin: "2027-01-30", checkout: "2027-02-01", habitaciones: [{ slug: "king-size", huespedes: 2 }] })).ok,
    false,
  );

  comprobar("PIN incorrecto", (await ejecutarComando(`confirmar ${c2.cotizacion.folio} 1111`)).respuesta, "PIN incorrecto.");
  const conf = await ejecutarComando(`confirmar ${c2.cotizacion.folio} 4821`);
  comprobar("confirmar con PIN", conf.respuesta.startsWith("✅"), true);
  comprobar("mensaje de confirmación para el huésped", conf.mensajesHuesped[0]?.chatId, A);
  const [b3] = await db.select().from(bookings).where(inArray(bookings.id, idsC2));
  comprobar("reserva confirmada por transferencia", [b3.estado, b3.formaPago, b3.montoPagado, b3.estadoPago], ["confirmada", "transferencia", 1080, "parcial"]);
  comprobar("confirmar dos veces no duplica", (await ejecutarComando(`confirmar ${c2.cotizacion.folio} 4821`)).respuesta.includes("ya estaba"), true);
  const salida = await db.select().from(botSalida).where(eq(botSalida.chatId, A));
  comprobar("la confirmación queda anotada como enviada", salida.length === 1 && salida[0].enviadoEn !== null, true);

  // ── Herramienta ver_mi_reserva ──────────────────────────────
  const efectos = { mensajesFijos: [], alertas: [] };
  const suya = JSON.parse((await ejecutarHerramienta("ver_mi_reserva", { folio: "" }, { chatId: A, telefono: "524810000001", nombrePerfil: "Juan" }, efectos)).contenido);
  comprobar("ver_mi_reserva: confirmada", suya.encontradas[0]?.estado, "CONFIRMADA");
  const ajena = JSON.parse((await ejecutarHerramienta("ver_mi_reserva", { folio: c2.cotizacion.folio }, { chatId: "5214819999999@c.us", telefono: "524819999999", nombrePerfil: "X" }, efectos)).contenido);
  comprobar("un folio ajeno no se enseña", ajena.encontradas.length, 0);

  // ── Recordatorios y vencimientos ────────────────────────────
  const B = "5214810000002@c.us";
  const c4 = await crearCotizacion({ chatId: B, telefono: "524810000002", nombre: "Ana", checkin: "2027-01-09", checkout: "2027-01-11", habitaciones: [{ slug: "doble-queen", huespedes: 2 }] });
  if (!c4.ok) throw new Error(c4.error);
  await db.update(botCotizaciones).set({ apartadoHasta: new Date(Date.now() + 30 * 60_000) }).where(eq(botCotizaciones.folio, c4.cotizacion.folio));
  const p1 = await tomarPendientes();
  comprobar("recordatorio 1 h antes de vencer", p1.some((m) => m.chatId === B && m.texto.includes("vence")), true);
  comprobar("el recordatorio sale una sola vez", (await tomarPendientes()).some((m) => m.chatId === B), false);
  await db.update(botCotizaciones).set({ apartadoHasta: new Date(Date.now() - 60 * 60_000) }).where(eq(botCotizaciones.folio, c4.cotizacion.folio));
  const p2 = await tomarPendientes();
  comprobar("aviso de apartado vencido", p2.some((m) => m.chatId === B && m.texto.includes("Se liberó")), true);
  comprobar("la cotización queda vencida", (await cotizacionPorFolio(c4.cotizacion.folio))?.estado, "vencida");

  // ── Interruptor, pausa y falla de la IA ─────────────────────
  await ponerBotActivo(false);
  comprobar("bot apagado no contesta", (await procesarTurno({ chatId: B, mensajes: ["hola"] })).silencio, "apagado");
  await ponerBotActivo(true);
  await pausar(B, 60);
  comprobar("chat en pausa no contesta", (await procesarTurno({ chatId: B, mensajes: ["hola"] })).silencio, "pausado");
  comprobar("pausar por teléfono con espacios", (await ejecutarComando("continuar 481 000 0002 4821")).respuesta.startsWith("▶️"), true);
  const falla = await procesarTurno({ chatId: B, nombre: "Ana", mensajes: ["hola"] });
  comprobar("si la IA falla: disculpa al huésped", falla.respuestas, [DISCULPA]);
  comprobar("…y aviso de falla a Gersay", falla.alertas.map((a) => a.tipo), ["falla"]);
  const falla2 = await procesarTurno({ chatId: B, nombre: "Ana", mensajes: ["¿sigues ahí?"] });
  comprobar("un segundo turno tras la falla no truena", falla2.respuestas, [DISCULPA]);
  const guardados = await db.select().from(botMensajes).where(eq(botMensajes.chatId, B));
  comprobar("solo se guardaron los turnos del huésped", guardados.every((m) => m.rol === "user"), true);

  // ── Probador del panel: misma cotización, CERO efectos ─────
  const { datosPanel } = await import("./panel");
  const { aplicar } = await import("./admin");
  const P = "prueba:abc123@c.us";
  const antes = (await db.select().from(bookings)).length;
  const cp = await crearCotizacion({
    chatId: P, telefono: "524810000000", nombre: "Prueba Panel", checkin: "2027-01-16", checkout: "2027-01-18",
    habitaciones: [{ slug: "king-size", huespedes: 2 }],
  });
  comprobar("prueba: la cotización sale con el precio real", cp.ok && cp.cotizacion.total, 2160);
  comprobar("prueba: NO crea reservas", (await db.select().from(bookings)).length, antes);
  const ocupa = await consultarDisponibilidad({ checkin: "2027-01-16", checkout: "2027-01-18", huespedes: 2 });
  comprobar("prueba: no ocupa cuartos", ocupa.ok && ocupa.opciones_un_cuarto.find((o) => o.slug === "king-size")?.cuartos_libres, 3);
  const demasiados = await crearCotizacion({
    chatId: P, telefono: "", nombre: "Prueba Panel", checkin: "2027-01-16", checkout: "2027-01-18",
    habitaciones: [1, 2, 3, 4].map(() => ({ slug: "king-size", huespedes: 2 })),
  });
  comprobar("prueba: tampoco promete cuartos que no hay (4 King de 3)", demasiados.ok, false);
  const panel = await datosPanel();
  comprobar("prueba: no aparece en el panel", panel.chats.some((c) => c.chatId === P) || panel.apartadas.some((c) => c.chatId === P), false);
  if (cp.ok) {
    await db.update(botCotizaciones).set({ apartadoHasta: new Date(Date.now() + 30 * 60_000) }).where(eq(botCotizaciones.folio, cp.cotizacion.folio));
    comprobar("prueba: sin recordatorios por WhatsApp", (await tomarPendientes()).some((m) => m.chatId === P), false);
    await registrarComprobante(P, "");
    const cf = await aplicar("confirmar", cp.cotizacion.folio);
    comprobar("prueba: confirmar funciona sin reservas", cf.respuesta.startsWith("✅"), true);
    comprobar("prueba: la confirmación se enseña pero no se encola", (await tomarPendientes()).some((m) => m.chatId === P), false);
  }
  await ponerBotActivo(false);
  const conApagado = await procesarTurno({ chatId: P, mensajes: ["hola"] });
  comprobar("prueba: funciona aunque el bot esté apagado", conApagado.silencio, undefined);
  await ponerBotActivo(true);

  console.log(fallos === 0 ? "\nTodo bien." : `\n${fallos} comprobación(es) fallaron.`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
