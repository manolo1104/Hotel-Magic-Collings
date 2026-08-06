// ============================================================
// ARRANQUE DEL SERVIDOR (Next.js llama register() una sola vez)
// Se usa para levantar el reloj de tareas periódicas. Ojo: register()
// debe TERMINAR antes de que el servidor atienda peticiones, así que
// aquí solo se programan los temporizadores — nada de trabajo pesado.
// ============================================================
export async function register(): Promise<void> {
  // El reloj usa temporizadores y Postgres: solo tiene sentido en Node.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Durante `next build` también se levantan procesos para prerenderizar:
  // ahí no queremos relojes ni sincronizaciones contra las OTAs.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { startScheduler } = await import("@/lib/scheduler");
  startScheduler();
}
