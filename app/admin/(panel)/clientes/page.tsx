import type { Metadata } from "next";
import { listBookings, getGuestNotes, getHiddenGuests } from "@/lib/booking/engine";
import { buildCRM } from "@/lib/admin/crm";
import { ClientesClient } from "@/components/admin/ClientesClient";

export const metadata: Metadata = { title: "Clientes", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const [reservas, notas, ocultos] = await Promise.all([
    listBookings(),
    getGuestNotes(),
    getHiddenGuests(),
  ]);
  const perfiles = buildCRM(reservas, notas, ocultos);
  return <ClientesClient perfiles={perfiles} />;
}
