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
import { JsonLd } from "@/components/JsonLd";
import { homeGraphJsonLd } from "@/lib/seo";

// Lee inventario de la BD en cada request (datos siempre frescos).
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <JsonLd data={homeGraphJsonLd()} />
      <Hero />
      <BarraValor />
      <Amenidades />
      <VistazoHabitaciones />
      <Estancia />
      <Huasteca />
      <Galeria />
      <Resenas />
      <Faq />
      <CtaFinal />
    </>
  );
}
