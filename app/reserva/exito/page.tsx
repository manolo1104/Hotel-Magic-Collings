import type { Metadata } from "next";
import { getBookingView } from "@/lib/booking/engine";
import { ResultadoReserva } from "@/components/booking/ResultadoReserva";
import { TrackConversion } from "@/components/booking/TrackConversion";

export const metadata: Metadata = { title: "Reserva confirmada", robots: { index: false } };
export const dynamic = "force-dynamic";

type SP = Promise<{ ref?: string | string[] }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const ref = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  const view = ref ? await getBookingView(ref) : null;
  return (
    <>
      {view && ref ? <TrackConversion referencia={ref} /> : null}
      <ResultadoReserva view={view} variante="exito" />
    </>
  );
}
