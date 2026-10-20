import type { Metadata } from "next";
import { datosPanel } from "@/lib/bot/panel";
import { WhatsAppClient } from "@/components/admin/WhatsAppClient";

export const metadata: Metadata = { title: "WhatsApp", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const datos = await datosPanel();
  return (
    <div className="w-full max-w-[1200px]">
      <header className="mb-7">
        <p className="k-eyebrow">Panel</p>
        <h1 className="k-title">WhatsApp</h1>
        <p className="k-subtitle">
          El asistente que contesta el WhatsApp del hotel: cotiza, aparta y te avisa cuando llega un pago
        </p>
      </header>
      <WhatsAppClient datos={datos} />
    </div>
  );
}
