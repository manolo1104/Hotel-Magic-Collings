import type { Metadata } from "next";
import { listQuotes, getRoomTypes } from "@/lib/booking/engine";
import { CotizacionesClient } from "@/components/admin/CotizacionesClient";

export const metadata: Metadata = { title: "Cotizaciones", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CotizacionesPage() {
  const [cotizaciones, tipos] = await Promise.all([
    listQuotes(),
    // includeHidden: el panel sí ve los tipos internos (p. ej. el cuarto de prueba)
    getRoomTypes({ includeHidden: true }),
  ]);
  const tiposOpc = tipos.map((t) => ({
    slug: t.slug,
    nombre: t.nombre,
    capacidad: t.capacidad,
  }));
  return <CotizacionesClient initial={cotizaciones} tipos={tiposOpc} />;
}
