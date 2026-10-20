/**
 * message-buffer.js
 * Espera por ráfaga de mensajes, con candado por chat.
 *
 * El cliente casi nunca escribe una sola vez: manda "hola", luego "somos 5",
 * luego "del 9 al 11". Aquí se espera a que DEJE de escribir y se contesta UNA vez,
 * a todo junto (mismo patrón que whatsapp-bot/buffer.js del bot de Huasteca).
 * Copiado TAL CUAL de Camila (mi-hotel/agentes/whatsapp-agent), donde está probado.
 *
 * - Ventana deslizante: cada mensaje nuevo reinicia la espera (debounceMs).
 * - Tope duro contado desde el PRIMER mensaje (maxWaitMs): quien escribe cada 14 s
 *   también recibe respuesta.
 * - CANDADO por chat: lo que llega mientras Camila responde se junta y se contesta en
 *   UNA pasada después, nunca en paralelo. Sin esto, dos llamadas simultáneas sobre el
 *   mismo historial duplicaban respuestas y folios.
 *
 * Lógica pura: sin WhatsApp ni red. El reloj es inyectable para probarlo con tiempo falso.
 *
 * Uso:
 *   const buffer = createMessageBuffer({ onFlush: async (key, batch) => { ... } });
 *   buffer.push(chatId, { type: 'text', text: msg.body }, { msg, chat, userName, contactNumber, resumeNote });
 *
 * item:  { type: 'text', text }
 *      | { type: 'proof', folio, kind: 'image'|'pdf', ackText, duplicate? }
 *      | { type: 'unsupported_media' }
 *
 * batch: { items, texts: string[], proofs: item[], unsupported: number,
 *          meta: { msg, chat, userName, contactNumber, resumeNote },
 *          firstAt, lastAt, count }
 */

const DEFAULT_CLOCK = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (t) => clearInterval(t),
};

// Campos de meta que siempre trae el batch (aunque nadie los haya mandado).
function emptyMeta() {
  return { msg: null, chat: null, userName: '', contactNumber: '', resumeNote: '' };
}

function isEmptyValue(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

// Los campos nuevos pisan a los viejos (último msg/chat/userName/contactNumber),
// salvo resumeNote: la nota de "el equipo atendió esta conversación" llega con el
// PRIMER mensaje tras la pausa y no debe perderse al juntarse con los siguientes.
// Un valor vacío (undefined, null, '') nunca borra uno que ya había.
function mergeMeta(target, incoming = {}) {
  for (const [field, value] of Object.entries(incoming || {})) {
    if (isEmptyValue(value)) continue;
    if (field === 'resumeNote') {
      if (isEmptyValue(target.resumeNote)) target.resumeNote = value;
      continue;
    }
    target[field] = value;
  }
}

function isValidItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.type === 'text') return typeof item.text === 'string' && item.text.trim() !== '';
  return item.type === 'proof' || item.type === 'unsupported_media';
}

export function createMessageBuffer({
  debounceMs = 15000,
  maxWaitMs = 60000,
  typingIntervalMs = 8000,
  onFlush,
  onTyping = () => {},
  onError = () => {},
  clock,
} = {}) {
  if (typeof onFlush !== 'function') throw new TypeError('createMessageBuffer: onFlush es obligatorio');
  const c = { ...DEFAULT_CLOCK, ...(clock || {}) };

  const buffers = new Map(); // key -> { items, meta, firstAt, lastAt, timer }
  const busy = new Set();    // keys con un onFlush EN CURSO

  const safeOnError = (err, key) => {
    try { onError(err, key); } catch { /* un log roto no tumba el buffer */ }
  };

  // Espera = min(lo que falta de silencio, lo que falta para el tope).
  function waitFor(buf) {
    const now = c.now();
    const bySilence = Math.max(0, debounceMs - (now - buf.lastAt));
    const byCap = Math.max(0, maxWaitMs - (now - buf.firstAt));
    return Math.min(bySilence, byCap);
  }

  function schedule(key) {
    const buf = buffers.get(key);
    if (!buf) return;
    if (buf.timer) c.clearTimeout(buf.timer);
    buf.timer = c.setTimeout(() => {
      fire(key).catch((err) => safeOnError(err, key));
    }, waitFor(buf));
    buf.timer?.unref?.();
  }

  function push(key, item, meta = {}) {
    if (!key || !isValidItem(item)) return;
    const now = c.now();
    let buf = buffers.get(key);
    if (!buf) {
      buf = { items: [], meta: emptyMeta(), firstAt: now, lastAt: now, timer: null };
      buffers.set(key, buf);
    }
    buf.items.push(item);
    buf.lastAt = now;
    mergeMeta(buf.meta, meta);
    schedule(key);
  }

  function buildBatch(buf) {
    const items = buf.items;
    return {
      items,
      texts: items.filter(i => i.type === 'text').map(i => i.text.trim()),
      proofs: items.filter(i => i.type === 'proof'),
      unsupported: items.filter(i => i.type === 'unsupported_media').length,
      meta: { ...buf.meta },
      firstAt: buf.firstAt,
      lastAt: buf.lastAt,
      count: items.length,
    };
  }

  async function fire(key) {
    const buf = buffers.get(key);
    if (!buf) return;
    if (buf.timer) { c.clearTimeout(buf.timer); buf.timer = null; }

    // ⚠️ CANDADO: si ya hay una respuesta en curso, NO se arranca otra. Lo pendiente
    // se queda en el buffer y el `finally` de la respuesta en curso lo reagenda.
    if (busy.has(key)) return;

    buffers.delete(key);
    const batch = buildBatch(buf);
    busy.add(key);

    // "Escribiendo…" inmediato y refrescado mientras dure la respuesta.
    const typing = () => {
      try {
        const r = onTyping(key, batch.meta);
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch { /* el indicador nunca rompe la respuesta */ }
    };
    typing();
    const typingTimer = typingIntervalMs > 0 ? c.setInterval(typing, typingIntervalMs) : null;
    typingTimer?.unref?.();

    try {
      await onFlush(key, batch);
    } catch (err) {
      safeOnError(err, key);
    } finally {
      if (typingTimer) c.clearInterval(typingTimer);
      busy.delete(key);
      // ¿Escribió más mientras se respondía? Se reagenda con la misma fórmula.
      if (buffers.has(key)) schedule(key);
    }
  }

  /** Tira lo pendiente de ese chat (p. ej. si un humano lo toma). No interrumpe una respuesta en curso. */
  function discard(key) {
    const buf = buffers.get(key);
    if (!buf) return 0;
    if (buf.timer) c.clearTimeout(buf.timer);
    buffers.delete(key);
    return buf.items.length;
  }

  return {
    push,
    discard,
    /** true si hay un onFlush en curso para esa key */
    isBusy: (key) => busy.has(key),
    /** cuántos items esperan (sin contar los que ya están en un onFlush en curso) */
    pending: (key) => buffers.get(key)?.items.length || 0,
    /** cuántas keys tienen items esperando */
    size: () => buffers.size,
  };
}
