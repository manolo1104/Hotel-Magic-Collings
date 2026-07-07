import { formatMXN } from "@/lib/utils";

/**
 * Precio en MXN renderizado en el SERVIDOR: aparece en el HTML servido (bueno
 * para SEO y sin parpadeo). Sustituye al antiguo <CountUp> en precios, que
 * renderizaba "$0" en el servidor y solo ponía el valor real en el cliente.
 *
 * Regla PERMANENTE (Fase 0): si la tarifa no es válida (0, negativa o NaN),
 * NUNCA se muestra "$0". Se muestra "Consultar tarifa" y se registra el error
 * para diagnóstico (fuente de datos no conectada, seed vacío, etc.).
 */
export function Precio({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const valido = Number.isFinite(value) && value > 0;
  if (!valido) {
    console.error(
      `[Precio] tarifa inválida (${value}); se muestra "Consultar tarifa" como fallback.`,
    );
    return <span className={className}>Consultar tarifa</span>;
  }
  return <span className={className}>{formatMXN(value)}</span>;
}
