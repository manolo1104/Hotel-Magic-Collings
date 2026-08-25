import type { Metadata } from "next";
import { listBookings, getRoomTypesPanel, listRooms, todayISO } from "@/lib/booking/engine";
import { ReservasClient } from "@/components/admin/ReservasClient";

export const metadata: Metadata = { title: "Reservas", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReservasPage() {
  const [reservas, tipos, cuartos] = await Promise.all([
    listBookings(),
    // El panel sí ve los tipos internos (p. ej. el cuarto de prueba), pero al
    // final de la lista para que no salgan preseleccionados.
    getRoomTypesPanel(),
    // Cuartos físicos: el selector de "cambiar de habitación" al editar.
    listRooms(),
  ]);
  const tiposOpc = tipos.map((t) => ({
    id: t.id,
    slug: t.slug,
    nombre: t.nombre,
    capacidad: t.capacidad,
  }));
  return (
    <ReservasClient
      initial={reservas}
      tipos={tiposOpc}
      cuartos={cuartos}
      today={todayISO()}
    />
  );
}
