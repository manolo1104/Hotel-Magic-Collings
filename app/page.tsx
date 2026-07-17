import { Hero } from "@/components/home/Hero";
import { BarraValor } from "@/components/home/BarraValor";
import { Amenidades } from "@/components/home/Amenidades";
import { VistazoHabitaciones } from "@/components/home/VistazoHabitaciones";
import { Estancia } from "@/components/home/Estancia";
import { Huasteca } from "@/components/home/Huasteca";
import { Galeria } from "@/components/home/Galeria";
import { Resenas } from "@/components/home/Resenas";
import { Faq } from "@/components/home/Faq";
import { CtaFinal } from "@/components/home/CtaFinal";
import { Ubicacion } from "@/components/home/Ubicacion";
import { JsonLd } from "@/components/JsonLd";
import { homeGraphJsonLd } from "@/lib/seo";

// ISR: se prerenderiza y revalida cada 10 min. Las tarifas/tipos de habitación
// cambian rara vez, así que no hace falta render por request (mejor TTFB/LCP).
export const revalidate = 600;

export default function Home() {
  return (
    <>
      <JsonLd data={homeGraphJsonLd()} />
      {/* Orden CRO: deseo (habitaciones) → argumento (directo vs OTA) →
          prueba social (reseñas) → contexto → objeciones → cierre */}
      <Hero />
      <BarraValor />
      <VistazoHabitaciones />
      <Estancia />
      <Ubicacion />
      <Resenas />
      <Amenidades />
      <Huasteca />
      <Galeria />
      <Faq />
      <CtaFinal />
    </>
  );
}
