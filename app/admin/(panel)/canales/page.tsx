import type { Metadata } from "next";
import { listRooms } from "@/lib/booking/engine";
import { listOtaChannels } from "@/lib/admin/ical";
import { CanalesClient } from "@/components/admin/CanalesClient";

export const metadata: Metadata = { title: "Canales", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CanalesPage() {
  const [canales, cuartos] = await Promise.all([listOtaChannels(), listRooms()]);
  return <CanalesClient canales={canales} cuartos={cuartos} />;
}
