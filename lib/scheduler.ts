// ============================================================
// PROGRAMADOR DE TAREAS (reloj dentro del propio servidor)
// Railway NO lee vercel.json, así que los crons de Vercel nunca se
// ejecutaban. Aquí vive el reloj: arranca una sola vez por proceso desde
// instrumentation.ts y dispara las tareas periódicas.
//
// Tareas:
//   · ical-sync   — baja los calendarios iCal de los canales OTA y los
//     convierte en bloqueos (para OTAs que no pasan por el channel manager).
//   · beds24-sync — las dos direcciones con Booking.com a través de Beds24:
//     repesca las reservas que entraron allá y sube las que nacieron aquí.
//     Es el respaldo del webhook: si un aviso se pierde, esto lo alcanza.
//     Solo corre si BEDS24_REFRESH_TOKEN está configurado.
//
// Variables de entorno (todas opcionales):
//   SCHEDULER_ENABLED   "0" apaga el reloj; "1" lo prende en desarrollo.
//                       Por defecto: prendido solo en producción.
//   ICAL_SYNC_MINUTES   cada cuántos minutos sincronizar iCal (default 15, mínimo 5).
//   BEDS24_SYNC_MINUTES cada cuántos minutos sincronizar Beds24 (default 5, mínimo 5).
//   SCHEDULER_DELAY_SEC espera antes de la primera corrida (default 30).
// ============================================================
const MINUTO = 60_000;

// Cacheado en globalThis: el hot-reload de desarrollo vuelve a evaluar el
// módulo y si no, se acumularían relojes duplicados.
const global_ = globalThis as unknown as { __mcScheduler?: boolean };

function numeroDeEnv(nombre: string, porDefecto: number, minimo: number): number {
  const n = Number(process.env[nombre]);
  return Number.isFinite(n) && n >= minimo ? n : porDefecto;
}

function habilitado(): boolean {
  const flag = process.env.SCHEDULER_ENABLED;
  if (flag === "0") return false;
  if (flag === "1") return true;
  return process.env.NODE_ENV === "production";
}

/**
 * Corre una tarea sin dejar que un error tumbe el servidor.
 * El candado contra corridas simultáneas lo pone cada tarea (ver
 * `conCandado` en lib/db/lock.ts), para que también proteja al panel.
 */
async function correr(nombre: string, tarea: () => Promise<unknown>): Promise<void> {
  const t0 = Date.now();
  try {
    const res = await tarea();
    console.log(`[cron] ${nombre} ok en ${Date.now() - t0}ms`, res ?? "");
  } catch (e) {
    console.error(`[cron] ${nombre} FALLÓ:`, e);
  }
}

/** Programa una tarea: primera corrida diferida, luego cada `minutos`. */
function programar(nombre: string, minutos: number, tarea: () => Promise<unknown>): void {
  const demora = numeroDeEnv("SCHEDULER_DELAY_SEC", 30, 0) * 1000;

  // La primera corrida se difiere para no pelear con el arranque del
  // servidor (Railway reinicia en cada deploy) ni retrasar el primer request.
  const inicial = setTimeout(() => {
    void correr(nombre, tarea);
    const repetidor = setInterval(() => void correr(nombre, tarea), minutos * MINUTO);
    repetidor.unref();
  }, demora);
  inicial.unref();

  console.log(`[cron] "${nombre}" programada cada ${minutos} min (primera en ${demora / 1000}s)`);
}

/** Arranca el reloj. Idempotente: llamarla dos veces no duplica tareas. */
export function startScheduler(): void {
  if (global_.__mcScheduler) return;
  global_.__mcScheduler = true;

  if (!habilitado()) {
    console.log("[cron] reloj apagado (SCHEDULER_ENABLED=1 para prenderlo en desarrollo)");
    return;
  }

  const minutos = numeroDeEnv("ICAL_SYNC_MINUTES", 15, 5);
  programar("ical-sync", minutos, async () => {
    const { syncAllChannels } = await import("@/lib/admin/ical");
    return await syncAllChannels();
  });

  // El channel manager solo se programa si está configurado: sin token no hay
  // nada que sincronizar y el reloj se quedaría llamando al vacío.
  if (process.env.BEDS24_REFRESH_TOKEN?.trim()) {
    const minutosB24 = numeroDeEnv("BEDS24_SYNC_MINUTES", 5, 5);
    programar("beds24-sync", minutosB24, async () => {
      const { sincronizarBeds24 } = await import("@/lib/beds24/sync");
      return await sincronizarBeds24();
    });
  } else {
    console.log("[cron] Beds24 no configurado (falta BEDS24_REFRESH_TOKEN); sin sincronización con Booking");
  }
}
