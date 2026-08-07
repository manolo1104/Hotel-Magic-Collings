import type { Metadata } from "next";
import { listRooms } from "@/lib/booking/engine";
import { listOtaChannels } from "@/lib/admin/ical";
import { estadoBeds24, habitacionesDisponibles } from "@/lib/beds24/sync";
import type { Beds24Room } from "@/lib/beds24/client";
import { CanalesClient } from "@/components/admin/CanalesClient";
import { Beds24Panel } from "@/components/admin/Beds24Panel";

export const metadata: Metadata = { title: "Canales", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CanalesPage() {
  const [canales, cuartos, estado] = await Promise.all([
    listOtaChannels(),
    listRooms(),
    estadoBeds24(),
  ]);

  // La lista de habitaciones de Beds24 es un extra: si su API falla, el panel
  // debe abrir igual y mostrar el error, no romperse.
  let habitaciones: Beds24Room[] = [];
  let errorConexion: string | null = null;
  try {
    habitaciones = await habitacionesDisponibles();
  } catch (e) {
    errorConexion = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="w-full max-w-[1200px]">
      <header className="mb-7">
        <p className="k-eyebrow">Panel</p>
        <h1 className="k-title">Canales de venta</h1>
        <p className="k-subtitle">Channel manager y calendarios de OTAs</p>
      </header>
      <Beds24Panel estado={estado} habitaciones={habitaciones} errorConexion={errorConexion} />
      <div className="mt-6">
        <CanalesClient canales={canales} cuartos={cuartos} />
      </div>
    </div>
  );
}
