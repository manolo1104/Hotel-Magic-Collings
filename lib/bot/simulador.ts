// ============================================================
// SIMULADOR DEL BOT — pláticas completas con Haiku REAL, base de PRUEBA
//
//   npm run bot:simular                 (una corrida)
//   npm run bot:simular -- --corridas 3 (tres seguidas: los tics de Haiku
//                                        solo se ven repitiendo)
//
// 🔴 NUNCA contra producción: `.env.local` trae la DATABASE_URL de Neon. Este
// script se niega a correr si hay DATABASE_URL en el entorno, y de .env.local
// lee SOLO la ANTHROPIC_API_KEY. La base es un PGlite nuevo en una carpeta
// temporal, sembrado como producción: 3 King Size, 3 Doble Queen, la Suite y
// el cierre por temporada hasta el 31 dic.
//
// Al final barre TODAS las respuestas buscando lo que falla 1 de cada N veces:
// voseo, palabras de máquina, montos que no salieron de una herramienta y la
// falta del aviso de asistente virtual. Escribe la transcripción completa.
// ============================================================
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// ── 1. Entorno seguro ANTES de importar nada que toque la base ─────────
if (process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL) {
  console.error("🔴 Hay DATABASE_URL en el entorno: el simulador NO corre contra una base real.");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) {
  const linea = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.startsWith("ANTHROPIC_API_KEY="));
  if (linea) process.env.ANTHROPIC_API_KEY = linea.slice("ANTHROPIC_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY (en el entorno o como línea de .env.local).");
  process.exit(1);
}
const carpeta = mkdtempSync(path.join(tmpdir(), "mc-bot-sim-"));
process.env.PGLITE_DIR = carpeta;
process.env.BANK_BANCO = "BBVA";
process.env.BANK_CLABE = "012180001234567899"; // falsa con dígito verificador válido
process.env.BANK_TITULAR = "Hotel Prueba S.A.";
process.env.BOT_ADMIN_PIN = "4821";
// Sin correos de verdad desde una prueba.
delete process.env.RESEND_API_KEY;
delete process.env.BREVO_API_KEY;

const corridas = Number(process.argv[process.argv.indexOf("--corridas") + 1]) || 1;

// ── 2. Escenarios ──────────────────────────────────────────────
type Paso =
  | { huesped: string[] }
  | { comprobante: true }
  | { confirmar: true };
type Escenario = { nombre: string; chatId: string; perfil: string; telefono?: string; pasos: Paso[]; espera: string };

const ESCENARIOS: Escenario[] = [
  {
    nombre: "noviembre cerrado",
    chatId: "5214810000001@c.us",
    perfil: "Laura",
    pasos: [{ huesped: ["Hola, ¿tienen habitación para 2 personas del 14 al 16 de noviembre?"] }],
    espera: "dice que está cerrado y ofrece fechas de enero; no cotiza",
  },
  {
    nombre: "pareja en enero",
    chatId: "5214810000002@c.us",
    perfil: "Juan",
    pasos: [
      { huesped: ["Buenas tardes, quiero reservar para mi esposa y yo del 16 al 18 de enero"] },
      { huesped: ["La King Size está bien"] },
      { huesped: ["Juan Pérez Hernández"] },
    ],
    espera: "opciones con total, pide nombre, crea cotización King Size",
  },
  {
    nombre: "grupo de 9",
    chatId: "5214810000003@c.us",
    perfil: "María",
    pasos: [
      { huesped: ["Somos 9 personas, del 6 al 8 de febrero de 2027, ¿qué opciones tienen?"] },
      { huesped: ["La de dos cuartos que salga más barata, a nombre de María López"] },
    ],
    espera: "combinaciones de cuartos; cotiza 2 cuartos para 9",
  },
  {
    nombre: "una noche (chat @lid)",
    chatId: "190000000000004@lid",
    perfil: "Carlos",
    pasos: [
      { huesped: ["¿Precio para 3 personas la noche del 23 de enero?"] },
      { huesped: ["Sí, la doble queen. A nombre de Carlos Ruiz"] },
      { huesped: ["Mi cel es 481 222 3344"] },
    ],
    espera: "pide teléfono (no se ve), cotiza 1 noche con pago completo",
  },
  {
    nombre: "cambio de fechas",
    chatId: "5214810000005@c.us",
    perfil: "Ana",
    pasos: [
      { huesped: ["Hola! Para 2 del 9 al 11 de enero, la king size, a nombre de Ana Torres"] },
      { huesped: ["Oye, mejor cambiemos al 23 al 25 de enero, misma habitación"] },
    ],
    espera: "segunda cotización reemplaza a la primera",
  },
  {
    nombre: "comprobante y confirmación",
    chatId: "5214810000006@c.us",
    perfil: "Pedro",
    pasos: [
      { huesped: ["Quiero la suite para 5 personas del 30 de enero al 1 de febrero, a nombre de Pedro Sánchez"] },
      { comprobante: true },
      { confirmar: true },
      { huesped: ["¿Ya quedó confirmada mi reserva?"] },
    ],
    espera: "acuse del comprobante; tras confirmar, responde que está confirmada",
  },
  {
    nombre: "mascotas",
    chatId: "5214810000007@c.us",
    perfil: "Sofía",
    pasos: [{ huesped: ["¿Puedo llevar a mi perrito? Es chiquito"] }],
    espera: "no se aceptan mascotas, amable",
  },
  {
    nombre: "cómo llegar y qué hacer",
    chatId: "5214810000008@c.us",
    perfil: "Diego",
    pasos: [{ huesped: ["¿Cómo llego desde Ciudad Valles? ¿Y qué hay que hacer cerca?"] }],
    espera: "hora y media por la 85; Xilitla/Las Pozas; sin vender tours",
  },
  {
    nombre: "pide persona",
    chatId: "5214810000009@c.us",
    perfil: "Roberto",
    pasos: [{ huesped: ["Quiero hablar con el dueño por favor, es sobre una factura de mi estancia pasada"] }],
    espera: "pasar_con_persona + aviso",
  },
  {
    nombre: "inglés",
    chatId: "5214810000010@c.us",
    perfil: "Mike",
    pasos: [{ huesped: ["Hi! Do you have a room for two from January 9 to 11?"] }],
    espera: "contesta en inglés con opciones",
  },
  {
    nombre: "ráfaga",
    chatId: "5214810000011@c.us",
    perfil: "Paty",
    pasos: [{ huesped: ["hola", "una pregunta", "¿tienen estacionamiento? y a qué hora es el check in"] }],
    espera: "una sola respuesta: sí estacionamiento sin costo, 13:00",
  },
  {
    nombre: "desayuno y niños",
    chatId: "5214810000012@c.us",
    perfil: "Lupita",
    pasos: [{ huesped: ["¿El hotel incluye desayuno? ¿Y cobran a los niños?"] }],
    espera: "no inventa: lo confirma el equipo",
  },
];

// ── 3. Un PDF mínimo de comprobante (para probar la lectura) ───
function pdfComprobante(monto: string): string {
  const texto = [
    "BBVA - Comprobante de transferencia SPEI",
    `Importe: ${monto} MXN`,
    "Fecha de operacion: 20/10/2026 15:42",
    "Beneficiario: Hotel Prueba S.A.",
    "Estado: Liquidada",
  ];
  const flujo = `BT /F1 14 Tf 60 760 Td 20 TL ${texto.map((l) => `(${l}) Tj T*`).join(" ")} ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1").toString("base64");
}

// ── 4. Barrido de tics ─────────────────────────────────────────
const VOSEO = /\b(tenés|querés|podés|sabés|decís|mirá|fijate|vosotros|vuestro|vuestra|os\s+(espero|esperamos|recomiendo)|vale\b|guay)/i;
const MAQUINA = /\b(sistema|herramienta|función|funcion|API|base de datos|prompt|simulacro|tool)\b/i;

function montosDe(t: string): number[] {
  return [...t.matchAll(/\$\s?([\d,]+(?:\.\d{2})?)/g)].map((m) => Math.round(Number(m[1].replace(/,/g, ""))));
}

async function main() {
  const { ensureDb } = await import("../db/ensure");
  const { db } = await import("../db");
  const { rooms, roomTypes, blocks, botMensajes, bookings } = await import("../db/schema");
  const { eq, asc } = await import("drizzle-orm");
  const { procesarTurno } = await import("./cerebro");
  const { procesarComprobante } = await import("./comprobante");
  const { ejecutarComando } = await import("./admin");
  const { cotizacionVigente, cotizacionesDelChat } = await import("./cotizacion");
  const { todayISO } = await import("../booking/engine");

  await ensureDb();
  // Inventario como producción: la semilla trae solo la Suite (y la de prueba).
  const tipos = await db.select().from(roomTypes);
  const porSlug = new Map(tipos.map((t) => [t.slug, t]));
  for (const [slug, prefijo] of [["king-size", "KS"], ["doble-queen", "DQ"]] as const) {
    const t = porSlug.get(slug)!;
    await db.insert(rooms).values([1, 2, 3].map((n) => ({ roomTypeId: t.id, numero: `${prefijo}-0${n}` })));
  }
  // Cierre por temporada, como en producción: todos los cuartos hasta el 31 dic.
  const todos = await db.select().from(rooms);
  await db.insert(blocks).values(
    todos.map((r) => ({ roomId: r.id, checkin: todayISO(), checkout: "2027-01-01", motivo: "manual", nota: "Cierre por temporada" })),
  );

  const transcripcion: string[] = [`# Simulación del bot — ${new Date().toISOString()} — ${corridas} corrida(s)\n`];
  const hallazgos: string[] = [];
  let respuestasTotales = 0;

  for (let corrida = 1; corrida <= corridas; corrida++) {
    // Cada corrida empieza con el hotel vacío: sin esto, la Suite que apartó la
    // corrida 1 sale ocupada en la 2 (el bot hace bien en decir que no hay).
    await db.update(bookings).set({ estado: "expirada" }).where(eq(bookings.origen, "whatsapp"));
    for (const esc of ESCENARIOS) {
      const chatId = corridas > 1 ? esc.chatId.replace(/(\d{3})@/, `${corrida}$1@`) : esc.chatId;
      transcripcion.push(`\n## [${corrida}] ${esc.nombre} — se espera: ${esc.espera}\n`);
      let primera = true;
      for (const paso of esc.pasos) {
        let respuestas: string[] = [];
        let alertas: { tipo: string; texto: string }[] = [];
        const t0 = Date.now();
        if ("huesped" in paso) {
          transcripcion.push(...paso.huesped.map((m) => `👤 ${m}`));
          const r = await procesarTurno({ chatId, nombre: esc.perfil, telefono: esc.telefono, mensajes: paso.huesped });
          respuestas = r.respuestas;
          alertas = r.alertas;
        } else if ("comprobante" in paso) {
          const c = await cotizacionVigente(chatId);
          if (!c) hallazgos.push(`[${corrida}] ${esc.nombre}: llegó el comprobante y NO había cotización (no cotizó cuando debía)`);
          transcripcion.push(`👤 [manda PDF de comprobante por ${c ? c.anticipo : "?"}]`);
          const r = await procesarComprobante({
            chatId,
            nombre: esc.perfil,
            mime: "application/pdf",
            base64: pdfComprobante(c ? `$${c.anticipo.toLocaleString("en-US")}.00` : "$1,000.00"),
          });
          respuestas = r.respuestas;
          alertas = r.alertas;
        } else {
          const c = (await cotizacionesDelChat(chatId))[0];
          const r = await ejecutarComando(`confirmar ${c?.folio ?? "MC-XXXX"} 4821`);
          transcripcion.push(`🧑‍💼 Gersay: confirmar ${c?.folio} → ${r.respuesta}`);
          respuestas = r.mensajesHuesped.map((m) => m.texto);
          const reservas = c
            ? await db.select().from(bookings).where(eq(bookings.notas, `Cotización ${c.folio} del bot de WhatsApp`))
            : [];
          if (!reservas.every((b) => b.estado === "confirmada" && b.formaPago === "transferencia"))
            hallazgos.push(`[${corrida}] ${esc.nombre}: la confirmación no dejó las reservas confirmadas`);
        }
        const ms = Date.now() - t0;
        for (const r of respuestas) transcripcion.push(`🤖 ${r.replace(/\n/g, "\n   ")}`);
        for (const a of alertas) transcripcion.push(`🔔 (a Gersay) ${a.texto.split("\n")[0]}`);
        transcripcion.push(`   ⏱️ ${(ms / 1000).toFixed(1)} s`);
        respuestasTotales += respuestas.length;

        // Barrido de esta respuesta
        if ("huesped" in paso) {
          const todo = respuestas.join("\n");
          if (VOSEO.test(todo)) hallazgos.push(`[${corrida}] ${esc.nombre}: VOSEO → ${todo.match(VOSEO)?.[0]}`);
          if (MAQUINA.test(todo)) hallazgos.push(`[${corrida}] ${esc.nombre}: palabra de máquina → ${todo.match(MAQUINA)?.[0]}`);
          if (primera && !/asistente virtual|virtual assistant/i.test(todo))
            hallazgos.push(`[${corrida}] ${esc.nombre}: primera respuesta SIN aviso de asistente virtual`);
          if (respuestas.some((r) => r.startsWith("Disculpa, tuve un problema")))
            hallazgos.push(`[${corrida}] ${esc.nombre}: respondió con la DISCULPA (falla)`);
          primera = false;
        }
      }

      // Montos: todo $ que escribió el MODELO debe existir en algún resultado de herramienta.
      const filas = await db
        .select({ rol: botMensajes.rol, contenido: botMensajes.contenido })
        .from(botMensajes)
        .where(eq(botMensajes.chatId, chatId))
        .orderBy(asc(botMensajes.orden));
      // Lo que el modelo SÍ pudo leer: resultados de herramientas y el contexto
      // del hotel (que trae total y anticipo de la cotización en juego).
      const conocidos = new Set<number>();
      for (const f of filas) {
        const s = JSON.stringify(f.contenido);
        if (f.rol === "user" && (s.includes("tool_result") || s.includes("contexto_del_hotel") || s.includes("comprobante de pago")))
          for (const m of s.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d{3,6})\b/g)) conocidos.add(Number(m[1].replace(/,/g, "")));
      }
      for (const f of filas) {
        if (f.rol !== "assistant" || !Array.isArray(f.contenido)) continue;
        for (const b of f.contenido as { type: string; text?: string }[]) {
          if (b.type !== "text" || !b.text) continue;
          for (const m of montosDe(b.text))
            if (!conocidos.has(m) && m > 0)
              hallazgos.push(`[${corrida}] ${esc.nombre}: monto $${m} que NO salió de una herramienta`);
        }
      }
      const cots = await cotizacionesDelChat(chatId);
      transcripcion.push(`   📋 cotizaciones: ${cots.map((c) => `${c.folio} ${c.estado} ${c.checkin}→${c.checkout} $${c.total}`).join(" · ") || "ninguna"}`);
    }
  }

  const archivo = path.join(carpeta, "transcripcion.md");
  writeFileSync(archivo, [...transcripcion, "\n# Hallazgos\n", ...(hallazgos.length ? hallazgos : ["(ninguno)"])].join("\n"));
  console.log(`\nRespuestas: ${respuestasTotales} · Hallazgos: ${hallazgos.length}`);
  for (const h of hallazgos) console.log(`  ❌ ${h}`);
  console.log(`\nTranscripción: ${archivo}`);
  process.exit(hallazgos.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
