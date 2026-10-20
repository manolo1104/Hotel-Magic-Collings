/**
 * Reloj falso para pruebas: cola de timers (setTimeout / setInterval) que solo avanza
 * cuando la prueba llama advance(ms). Compatible con el `clock` de message-buffer.js.
 *
 *   const clock = createFakeClock();
 *   await clock.advance(15000); // corre en orden los timers vencidos y deja correr las promesas
 */

export function createFakeClock(startMs = Date.UTC(2026, 8, 12, 18, 0, 0)) {
  let current = startMs;
  let seq = 0;
  const timers = new Map(); // id -> { id, at, fn, every }

  const makeHandle = (id) => ({ id, unref() { return this; }, ref() { return this; }, hasRef() { return false; } });

  function add(fn, ms, every) {
    const id = ++seq;
    const delay = Math.max(0, Number(ms) || 0);
    timers.set(id, { id, at: current + delay, fn, every: every ? Math.max(1, delay) : 0 });
    return makeHandle(id);
  }

  function clear(handle) {
    if (handle == null) return;
    timers.delete(typeof handle === 'object' ? handle.id : handle);
  }

  // Deja correr microtareas y continuaciones async (onFlush, finally, etc.).
  async function flush(rounds = 5) {
    for (let i = 0; i < rounds; i++) await new Promise(resolve => setImmediate(resolve));
  }

  function nextDue(target) {
    let next = null;
    for (const t of timers.values()) {
      if (t.at > target) continue;
      if (!next || t.at < next.at || (t.at === next.at && t.id < next.id)) next = t;
    }
    return next;
  }

  async function advance(ms = 0) {
    const target = current + Math.max(0, Number(ms) || 0);
    await flush();
    for (let guard = 0; guard < 100000; guard++) {
      const t = nextDue(target);
      if (!t) break;
      current = t.at;
      if (t.every) t.at = current + t.every;
      else timers.delete(t.id);
      t.fn();
      await flush();
    }
    current = target;
    await flush();
  }

  return {
    now: () => current,
    setTimeout: (fn, ms) => add(fn, ms, false),
    clearTimeout: clear,
    setInterval: (fn, ms) => add(fn, ms, true),
    clearInterval: clear,
    advance,
    flush,
    /** cuántos timers siguen vivos */
    pendingTimers: () => timers.size,
  };
}

/** Promesa que la prueba resuelve o rechaza a mano. */
export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
