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
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-6 pb-20 sm:px-6 lg:pt-8">
      <h1 className="mb-5 font-heading text-2xl font-semibold sm:text-3xl">Canales de venta</h1>
      <Beds24Panel estado={estado} habitaciones={habitaciones} errorConexion={errorConexion} />
      <div className="mt-8">
        <CanalesClient canales={canales} cuartos={cuartos} />
      </div>
    </div>
  );
}
