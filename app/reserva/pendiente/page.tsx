import type { Metadata } from "next";
import { getBookingView } from "@/lib/booking/engine";
import { ResultadoReserva } from "@/components/booking/ResultadoReserva";

export const metadata: Metadata = { title: "Reserva en proceso", robots: { index: false } };
export const dynamic = "force-dynamic";

type SP = Promise<{ ref?: string | string[] }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const ref = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  const view = ref ? await getBookingView(ref) : null;
  return <ResultadoReserva view={view} variante="pendiente" />;
}
