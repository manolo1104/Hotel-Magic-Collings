/**
 * PUENTE DE WHATSAPP — Hotel Magic Collinn
 *
 * Conecta el WhatsApp del hotel (481 100 9939) como "dispositivo vinculado"
 * (QR, whatsapp-web.js) y pasa los mensajes al sitio, donde vive el cerebro
 * (/api/bot/*: Haiku 5.5, disponibilidad real, cotizaciones). Aquí NO hay
 * IA ni precios: solo transporte, como un mesero que lleva y trae.
 *
 * Lo que se copió de Camila (Paraíso) porque ya se pagó aprendiéndolo:
 *  · espera por ráfaga con candado por chat (message-buffer.js)
 *  · limpieza de candados de Chromium al arrancar (si no: "Code 21" en bucle)
 *  · envío con escalera de intentos (los chats @lid fallan seguido)
 *  · descarte de mensajes reemitidos (53 duplicados en una semana)
 *  · bajo @lid, contact.number NO es el teléfono
 *  · avisos al número personal, no a un grupo (grupos rotos desde jul 2026)
 */
import { createServer } from 'node:http';
import { rmSync } from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import pkg from 'whatsapp-web.js';
import { createMessageBuffer } from './message-buffer.js';
import { sitio } from './sitio.js';
import { pareceComando } from './comandos.js';

const { Client, LocalAuth } = pkg;

// ── Configuración ─────────────────────────────────────────────
const env = (k, d = '') => (process.env[k] ?? d).trim();
const envNum = (k, d) => {
  const n = Number(process.env[k]);
  return Number.isFinite(n) && n >= 0 ? n : d;
};
const DATA_PATH = env('WWEBJS_DATA_PATH') || './.wwebjs_auth';
const CLIENT_ID = 'magic-collinn';
const QR_TOKEN = env('QR_PAGE_TOKEN');
const PUERTO = envNum('PORT', 3001);
const DEBOUNCE_MS = envNum('MESSAGE_DEBOUNCE_MS', 15_000);
const MAX_WAIT_MS = envNum('MESSAGE_MAX_WAIT_MS', 60_000);
const TOMA_HUMANA_MIN = envNum('HUMAN_TAKEOVER_MIN', 12 * 60);
const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const lista = (k) => env(k).split(/[,;\s]+/).map(soloDigitos).filter((d) => d.length >= 10);
// A quién avisar (número personal de Gersay, 52 + 10 dígitos).
const DUENOS = lista('OWNER_WHATSAPP');
// Números de prueba a los que el bot SÍ contesta aunque estén en la agenda.
const SIEMPRE = new Set(lista('ALWAYS_RESPOND_NUMBERS').map((d) => d.slice(-10)));

const DISCULPA = 'Disculpa, tuve un problema para contestarte. En un momento te escribe alguien del equipo del hotel 🙏';
const MEDIA_NO_LEIBLE = new Set(['ptt', 'audio', 'video', 'sticker', 'location', 'vcard', 'multi_vcard']);
const SOLO_TEXTO = 'Por ahora solo puedo leer texto, fotos y PDF 🙏 ¿Me lo escribes, por favor?';

if (!sitio.configurado()) {
  console.error('❌ Falta BOT_SECRET: sin él el sitio rechaza todo.');
  process.exit(1);
}

// ── Estado ────────────────────────────────────────────────────
let estado = 'iniciando'; // iniciando | qr | autenticado | listo | desconectado
let ultimoQr = '';
let autenticadoDesde = 0;

// ── Candados viejos de Chromium ───────────────────────────────
function limpiarCandadosChromium() {
  const dir = path.join(DATA_PATH, `session-${CLIENT_ID}`);
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort'])
    try { rmSync(path.join(dir, f), { force: true, recursive: true }); } catch { /* nada */ }
}

// ── Cliente ───────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ clientId: CLIENT_ID, dataPath: DATA_PATH }),
  puppeteer: {
    executablePath: env('PUPPETEER_EXECUTABLE_PATH') || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    protocolTimeout: 120_000,
    // Los mismos que Camila midió para gastar menos RAM en Railway. NO usar
    // --single-process ni topes de heap: tumban la pestaña.
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
      '--disable-software-rasterizer', '--in-process-gpu', '--no-zygote', '--no-first-run',
      '--disable-extensions', '--disable-component-extensions-with-background-pages',
      '--disable-background-networking', '--disable-default-apps', '--disable-sync',
      '--mute-audio', '--disk-cache-size=1', '--media-cache-size=1',
    ],
  },
});

// ── Alias de un mismo chat ────────────────────────────────────
// El mismo huésped puede aparecer como "52…@c.us" en un evento y "…@lid" en
// otro. Se guarda el id con el que ESCRIBIÓ (el que usa el sitio) y sus alias.
const alias = new Map();
const canonico = (id) => alias.get(String(id)) || String(id);
function recordarAlias(chatId, ...otros) {
  alias.set(chatId, chatId);
  for (const o of otros) if (o) alias.set(String(o), chatId);
  if (alias.size > 5000) alias.clear();
}

// ── Lo que manda el bot (para no confundirlo con Gersay escribiendo) ──
const enviadosPorBot = new Map(); // texto recortado → hora
const marcaTexto = (t) => String(t ?? '').trim().slice(0, 120);
function anotarEnvio(texto) {
  enviadosPorBot.set(marcaTexto(texto), Date.now());
  if (enviadosPorBot.size > 500) {
    const limite = Date.now() - 5 * 60_000;
    for (const [k, t] of enviadosPorBot) if (t < limite) enviadosPorBot.delete(k);
  }
}
const loMandoElBot = (texto) => {
  const t = enviadosPorBot.get(marcaTexto(texto));
  return t !== undefined && Date.now() - t < 5 * 60_000;
};

// Escalera de envío: directo → vía Chat → resolviendo el número.
async function enviar(to, contenido, opciones) {
  if (typeof contenido === 'string') anotarEnvio(contenido);
  if (opciones?.caption) anotarEnvio(opciones.caption);
  try {
    return await client.sendMessage(to, contenido, opciones);
  } catch (primero) {
    try {
      const chat = await client.getChatById(to);
      if (chat) return await chat.sendMessage(contenido, opciones);
    } catch { /* siguiente */ }
    if (String(to).endsWith('@c.us')) {
      try {
        const wid = await client.getNumberId(String(to).replace('@c.us', ''));
        if (wid?._serialized && wid._serialized !== to) return await client.sendMessage(wid._serialized, contenido, opciones);
      } catch { /* sin más */ }
    }
    throw primero;
  }
}

async function avisarDuenos(texto, media) {
  for (const n of DUENOS) {
    try {
      if (media) await enviar(`${n}@c.us`, media, { caption: texto.slice(0, 1000) });
      else await enviar(`${n}@c.us`, texto);
    } catch (e) {
      console.warn(`⚠️ No se pudo avisar a ${n}:`, String(e?.message || e).split('\n')[0]);
    }
  }
}

// Freno para que una caída no mande 50 avisos de falla.
let ultimoAvisoFalla = 0;
async function avisarFalla(texto) {
  if (Date.now() - ultimoAvisoFalla < 10 * 60_000) return;
  ultimoAvisoFalla = Date.now();
  await avisarDuenos(texto);
}

async function mandarAlertas(alertas = []) {
  for (const a of alertas) {
    if (a.tipo === 'falla') await avisarFalla(a.texto);
    else await avisarDuenos(a.texto);
  }
}

async function contestar(chatId, textos = []) {
  for (const t of textos) {
    if (!t?.trim()) continue;
    try {
      await enviar(chatId, t);
    } catch (e) {
      console.error(`❌ No se pudo contestar a ${chatId}:`, String(e?.message || e).split('\n')[0]);
    }
    await new Promise((r) => setTimeout(r, 900)); // que no lleguen todos encimados
  }
}

// ── Comandos de Gersay ("confirmar MC-7K2P 1234") ─────────────

async function atenderComando(texto, responderA) {
  try {
    const r = await sitio.admin(texto);
    if (responderA) await enviar(responderA, r.respuesta);
    for (const m of r.mensajesHuesped || []) await contestar(m.chatId, [m.texto]);
  } catch (e) {
    console.error('❌ Comando falló:', String(e?.message || e));
    if (responderA) await enviar(responderA, 'No se pudo ejecutar el comando; intenta de nuevo en un minuto.').catch(() => {});
  }
}

// ── La ráfaga de un chat, ya juntada ──────────────────────────
const rafagas = createMessageBuffer({
  debounceMs: DEBOUNCE_MS,
  maxWaitMs: MAX_WAIT_MS,
  onTyping: async (chatId) => {
    try { (await client.getChatById(chatId))?.sendStateTyping(); } catch { /* opcional */ }
  },
  onError: (err, chatId) => console.error(`❌ Ráfaga de ${chatId}:`, err),
  onFlush: async (chatId, lote) => {
    const { nombre, telefono } = lote.meta.msg ?? {};
    // 1) Comprobantes primero: así el turno de texto ya sabe que llegó.
    for (const p of lote.proofs) {
      try {
        const r = await sitio.comprobante({ chatId, telefono, nombre, mime: p.mime, base64: p.data });
        await contestar(chatId, r.respuestas);
        await mandarAlertas(r.alertas);
      } catch (e) {
        console.error('❌ Comprobante falló:', String(e?.message || e));
        await avisarFalla(`⚠️ Llegó un archivo de ${nombre || chatId} y el sitio no respondió. Revísalo en el WhatsApp del hotel.`);
      }
    }
    // 2) Lo que escribió.
    if (lote.texts.length > 0) {
      try {
        const r = await sitio.turno({ chatId, telefono, nombre, mensajes: lote.texts });
        if (r.silencio) console.log(`🤫 ${chatId}: ${r.silencio}`);
        await contestar(chatId, r.respuestas);
        await mandarAlertas(r.alertas);
      } catch (e) {
        console.error('❌ Turno falló:', String(e?.message || e));
        await contestar(chatId, [DISCULPA]);
        await avisarFalla(`⚠️ El bot no pudo contestarle a ${nombre || chatId} (${telefono ? `wa.me/${telefono}` : 'número oculto'}): el sitio no respondió. Escríbele tú, por favor.`);
      }
    } else if (lote.unsupported > 0 && lote.proofs.length === 0) {
      await contestar(chatId, [SOLO_TEXTO]);
    }
  },
});

// ── Mensajes que llegan ───────────────────────────────────────
const vistos = new Map(); // id del mensaje → hora (whatsapp-web.js reemite)
function yaVisto(msg) {
  const id = msg.id?._serialized || msg.id?.id;
  if (!id) return false;
  if (vistos.has(id)) return true;
  vistos.set(id, Date.now());
  if (vistos.size > 3000) {
    const limite = Date.now() - 60 * 60_000;
    for (const [k, t] of vistos) if (t < limite) vistos.delete(k);
  }
  return false;
}

client.on('message', async (msg) => {
  try {
    if (msg.fromMe || msg.isStatus || yaVisto(msg)) return;
    const de = String(msg.from || '');
    if (de.endsWith('@g.us') || de.endsWith('@broadcast') || de.endsWith('@newsletter') || msg.author) return;
    const cuerpo = String(msg.body || '').trim();
    if (/^\d{10,25}@(lid|c\.us|g\.us)$/.test(cuerpo)) return; // evento interno colado como texto

    // Comandos de Gersay: van antes del filtro de contactos (su número sí está en la agenda).
    if (msg.type === 'chat' && pareceComando(cuerpo)) {
      await atenderComando(cuerpo, de);
      return;
    }

    let chat = null;
    let contacto = null;
    try { chat = await msg.getChat(); } catch { /* bajo @lid falla seguido: se sigue */ }
    if (chat?.isGroup) return;
    try { contacto = await msg.getContact(); } catch { /* idem */ }

    // Bajo @lid, contact.number trae los dígitos del lid, no el teléfono: se descarta.
    const digitos = soloDigitos(contacto?.number || '');
    const telefono = de.endsWith('@lid') && digitos === soloDigitos(de.split('@')[0]) ? '' : digitos;
    recordarAlias(de, chat?.id?._serialized, contacto?.id?._serialized, telefono && `${telefono}@c.us`);

    // Solo desconocidos: amigos y proveedores de la agenda no reciben al bot.
    const esPrueba = SIEMPRE.has(telefono.slice(-10)) || SIEMPRE.has(soloDigitos(de).slice(-10));
    if (contacto?.isMyContact && !esPrueba) return;

    const meta = { msg: { nombre: contacto?.pushname || contacto?.name || '', telefono } };

    if (msg.hasMedia && (msg.type === 'image' || msg.type === 'document')) {
      let media = null;
      try { media = await msg.downloadMedia(); } catch { /* se avisa abajo */ }
      const mime = media?.mimetype || '';
      const esComprobante = mime.startsWith('image/') || mime === 'application/pdf';
      if (media && esComprobante) {
        // El archivo le llega a Gersay tal cual: el dinero lo ve él.
        await avisarDuenos(`🧾 Archivo de ${meta.msg.nombre || 'un huésped'} (${telefono ? `wa.me/${telefono}` : de})`, media);
        rafagas.push(de, { type: 'proof', mime, data: media.data }, meta);
        if (cuerpo) rafagas.push(de, { type: 'text', text: cuerpo }, meta); // el pie de foto
        return;
      }
      rafagas.push(de, { type: 'unsupported_media' }, meta);
      return;
    }
    if (msg.type !== 'chat') {
      // Audio, video, sticker… se avisa que no se leen. Los avisos internos de
      // WhatsApp (mensaje borrado, llamada, cifrado) se ignoran en silencio.
      if (MEDIA_NO_LEIBLE.has(msg.type)) rafagas.push(de, { type: 'unsupported_media' }, meta);
      return;
    }
    if (!cuerpo) return;
    rafagas.push(de, { type: 'text', text: cuerpo }, meta);
  } catch (e) {
    console.error('❌ Error con un mensaje entrante:', e);
  }
});

// ── Lo que se escribe DESDE el teléfono del hotel ─────────────
// Si es un comando, se ejecuta. Si es Gersay contestando a mano, el bot se
// calla en ese chat (toma humana) para no pisarle la plática.
client.on('message_create', async (msg) => {
  try {
    if (!msg.fromMe) return;
    const cuerpo = String(msg.body || '').trim();
    if (!cuerpo && !msg.hasMedia) return; // eventos internos sin contenido
    if (msg.type === 'chat' && pareceComando(cuerpo)) {
      // Escrito en el propio teléfono del hotel: el resultado va al número de
      // Gersay, nunca al chat donde lo tecleó (podría ser el de un huésped).
      await atenderComando(cuerpo, DUENOS[0] ? `${DUENOS[0]}@c.us` : null);
      return;
    }
    const para = String(msg.to || msg.id?.remote || '');
    if (!para || para.endsWith('@g.us') || para.endsWith('@broadcast')) return;
    if (loMandoElBot(cuerpo || msg.caption)) return;
    if (DUENOS.some((n) => para.startsWith(n))) return; // avisos a Gersay
    const chatId = canonico(para);
    rafagas.discard(chatId);
    await sitio.pausa(chatId, TOMA_HUMANA_MIN);
    console.log(`🙋 Toma humana en ${chatId}: el bot se calla ${TOMA_HUMANA_MIN} min`);
  } catch (e) {
    console.warn('⚠️ message_create:', String(e?.message || e).split('\n')[0]);
  }
});

// ── Mensajes que el sitio quiere mandar (recordatorios, confirmaciones) ──
async function revisarPendientes() {
  if (estado !== 'listo') return;
  try {
    const { mensajes = [] } = await sitio.pendientes();
    for (const m of mensajes) await contestar(m.chatId, [m.texto]);
  } catch (e) {
    console.warn('⚠️ pendientes:', String(e?.message || e).split('\n')[0]);
  }
}
setInterval(revisarPendientes, 60_000).unref();

// ── Ciclo de vida ─────────────────────────────────────────────
client.on('qr', (qr) => {
  estado = 'qr';
  ultimoQr = qr;
  console.log('📱 QR nuevo: ábrelo en la página de estado y escanéalo con el teléfono del hotel.');
});
client.on('authenticated', () => {
  estado = 'autenticado';
  autenticadoDesde = Date.now();
  console.log('✅ WhatsApp autenticado');
});
client.on('auth_failure', (m) => {
  console.error('❌ Falló la autenticación:', m);
  process.exit(1);
});
client.on('ready', async () => {
  estado = 'listo';
  ultimoQr = '';
  console.log('🏨 Magic Collinn — puente de WhatsApp ACTIVO');
  try {
    const s = await sitio.salud();
    console.log(`🧠 Sitio: ${JSON.stringify(s)}`);
    const problemas = [
      s.anthropic !== 'ok' && `la IA no responde (${s.anthropic})`,
      !s.datosBancarios && 'faltan los datos bancarios (las cotizaciones no dirán a dónde transferir)',
      !s.pinConfigurado && 'falta el PIN de comandos',
      !s.botActivo && 'el bot está APAGADO desde el panel',
    ].filter(Boolean);
    if (problemas.length) await avisarFalla(`⚠️ El bot de WhatsApp arrancó con problemas: ${problemas.join('; ')}.`);
  } catch (e) {
    console.error('❌ El sitio no responde a /api/bot/salud:', String(e?.message || e));
    await avisarFalla('⚠️ El bot de WhatsApp arrancó pero el sitio no responde: no podrá contestar.');
  }
});
client.on('disconnected', (motivo) => {
  estado = 'desconectado';
  console.error('🔌 WhatsApp desconectado:', motivo);
  // Railway lo reinicia (restartPolicy ON_FAILURE) con la sesión del volumen.
  setTimeout(() => process.exit(1), 2_000);
});

// Atorado en "autenticado" sin llegar a "listo" (pasó en Paraíso tras varios
// reinicios seguidos): en ese estado no se procesan mensajes. Se reinicia.
setInterval(() => {
  if (estado === 'autenticado' && Date.now() - autenticadoDesde > 4 * 60_000) {
    console.error('⏱️ 4 min en "autenticado" sin llegar a "listo": reinicio.');
    process.exit(1);
  }
}, 30_000).unref();

// Chromium muerto = el proceso no sirve: mejor reiniciar que quedarse sordo.
process.on('unhandledRejection', (e) => {
  const m = String(e?.message || e);
  console.error('⚠️ unhandledRejection:', m.split('\n')[0]);
  if (/Session closed|Target closed|Protocol error|browser has disconnected/i.test(m)) process.exit(1);
});

// ── Página de estado y QR ─────────────────────────────────────
const pagina = (cuerpo) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="10">
<title>Bot Magic Collinn</title><style>body{font-family:system-ui,sans-serif;background:#FAFAF8;color:#1B4332;
display:flex;justify-content:center;padding:32px 16px}main{max-width:420px;text-align:center}
img{width:280px;height:280px;border:8px solid #fff;border-radius:12px;box-shadow:0 2px 12px #0002}
ol{text-align:left}.ok{font-size:56px}</style></head><body><main>${cuerpo}</main></body></html>`;

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: estado }));
      return;
    }
    if (!QR_TOKEN || url.searchParams.get('token') !== QR_TOKEN) {
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pagina('<h1>🔒 Acceso restringido</h1><p>Falta el <b>?token=…</b> al final de la dirección.</p>'));
      return;
    }
    let cuerpo;
    if (estado === 'listo') cuerpo = '<div class="ok">✅</div><h1>El bot está conectado</h1><p>Contestando el WhatsApp del hotel.</p>';
    else if (ultimoQr)
      cuerpo = `<h1>📱 Vincula el WhatsApp del hotel</h1><img alt="Código QR" src="${await QRCode.toDataURL(ultimoQr, { margin: 1, width: 280 })}">
<ol><li>Abre WhatsApp en el teléfono del hotel (481 100 9939)</li><li>Menú (⋮) → <b>Dispositivos vinculados</b></li>
<li><b>Vincular un dispositivo</b> y escanea este código</li></ol><p>La página se actualiza sola.</p>`;
    else cuerpo = `<div class="ok">⏳</div><h1>Iniciando…</h1><p>Estado: ${estado}. El código aparecerá aquí solo.</p>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(pagina(cuerpo));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Error: ${e?.message || e}`);
  }
}).listen(PUERTO, () => console.log(`🌐 Página de estado en el puerto ${PUERTO}`));

console.log(`🚀 Iniciando puente de WhatsApp de Magic Collinn → ${sitio.url}`);
limpiarCandadosChromium();
client.initialize();

