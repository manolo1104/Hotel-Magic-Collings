// ============================================================
// Medición de embudo — DESACTIVABLE.
// Si no hay proveedor de analítica (gtag/dataLayer) cargado —p. ej. sin
// NEXT_PUBLIC_GA_ID configurado— esta función NO hace nada. Cuando GA4 está
// activo (ver lib/site.ts → gaId + app/layout.tsx), envía el evento.
// Nunca lanza: la analítica jamás debe romper la UI.
//
// Eventos sugeridos del embudo: view_room, begin_booking, add_dates,
// submit_reservation, whatsapp_click.
// ============================================================
type Params = Record<string, string | number | boolean | undefined>;

export function track(event: string, params?: Params): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  };
  try {
    if (typeof w.gtag === "function") {
      w.gtag("event", event, params ?? {});
    } else if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event, ...params });
    }
    // Sin proveedor cargado: no-op silencioso.
  } catch {
    // Ignorar: la medición nunca debe afectar la experiencia.
  }
}
