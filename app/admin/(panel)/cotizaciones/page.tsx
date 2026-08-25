import type { Metadata } from "next";
import { listQuotes, getRoomTypesPanel } from "@/lib/booking/engine";
import { CotizacionesClient } from "@/components/admin/CotizacionesClient";

export const metadata: Metadata = { title: "Cotizaciones", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CotizacionesPage() {
  const [cotizaciones, tipos] = await Promise.all([
    listQuotes(),
    // El panel sí ve los tipos internos (p. ej. el cuarto de prueba), pero al
    // final de la lista para que no salgan preseleccionados.
    getRoomTypesPanel(),
  ]);
  const tiposOpc = tipos.map((t) => ({
    id: t.id,
    slug: t.slug,
    nombre: t.nombre,
    capacidad: t.capacidad,
  }));
  return <CotizacionesClient initial={cotizaciones} tipos={tiposOpc} />;
}
