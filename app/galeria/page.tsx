import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
import { Photo } from "@/components/Photo";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd, imageGalleryJsonLd } from "@/lib/seo";
import { Reveal } from "@/components/motion/Reveal";
import { WordsReveal } from "@/components/motion/WordsReveal";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Gallery, GalleryTile } from "@/components/gallery/Lightbox";

export const metadata: Metadata = {
  title: "Galería de fotos",
  description: `Fotos reales del ${site.legalName} en ${site.locality}: fachada, corredor de arcos, habitaciones sencillas y dobles. Así se ve el hotel que vas a reservar.`,
  alternates: { canonical: "/galeria" },
};

type From = "bottom" | "left" | "right" | "top";

// Las 15 fotos reales del hotel (public/imagenes/), con ritmo de anchas:
// en md:grid-cols-4 los spans suman 20 → 5 filas exactas, sin huecos.
// La primera es col-span-2 también en móvil → 16 spans = 8 filas parejas.
const tiles: {
  src: string;
  alt: string;
  wide?: boolean;
  wideMobile?: boolean;
  from: From;
}[] = [
  { src: "/imagenes/fachada-jardin.jpg", alt: "Fachada y jardín del Hotel Magic Collinn", wide: true, wideMobile: true, from: "left" },
  { src: "/imagenes/corredor-arcos.jpg", alt: "Corredor con arcos y plantas del hotel", wide: true, from: "right" },
  { src: "/imagenes/fachada-entrada.jpg", alt: "Entrada principal del Hotel Magic Collinn en Axtla de Terrazas", from: "bottom" },
  { src: "/imagenes/entrada-noche.jpg", alt: "Entrada del hotel iluminada de noche", wide: true, from: "left" },
  { src: "/imagenes/fachada-lateral.jpg", alt: "Vista lateral de la fachada del hotel", from: "bottom" },
  { src: "/imagenes/sencilla-1.jpg", alt: "Habitación sencilla con cama matrimonial y clima", from: "bottom" },
  { src: "/imagenes/sencilla-2.jpg", alt: "Habitación sencilla, vista hacia la ventana", from: "bottom" },
  { src: "/imagenes/sencilla-3.jpg", alt: "Detalle de la habitación sencilla", from: "bottom" },
  { src: "/imagenes/doble-1.jpg", alt: "Habitación doble con dos camas matrimoniales", from: "bottom" },
  { src: "/imagenes/doble-2.jpg", alt: "Habitación doble del Hotel Magic Collinn", from: "bottom" },
  { src: "/imagenes/doble-estancia.jpg", alt: "Habitación doble con sala de estar", wide: true, from: "right" },
  { src: "/imagenes/doble-3.jpg", alt: "Habitación doble, vista general", from: "bottom" },
  { src: "/imagenes/doble-4.jpg", alt: "Detalle de la habitación doble", from: "bottom" },
  { src: "/imagenes/doble-5.jpg", alt: "Habitación doble amplia y climatizada", wide: true, from: "bottom" },
  { src: "/imagenes/doble-6.jpg", alt: "Habitación doble, otra vista", from: "bottom" },
];

const photos = tiles.map((t) => ({ src: t.src, alt: t.alt }));

export default function GaleriaPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-28 pb-20 sm:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: "/" },
          { name: "Galería", url: "/galeria" },
        ])}
      />
      <JsonLd data={imageGalleryJsonLd(photos)} />

      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Galería</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold sm:text-5xl">
          <WordsReveal text="El hotel en fotos" />
        </h1>
        <Reveal delay={0.3} className="mt-4">
          <p className="leading-relaxed text-muted-foreground">
            Fotos reales de {site.name}: la fachada, el corredor de arcos y
            nuestras habitaciones sencillas y dobles. Lo que ves es lo que te
            recibe. Toca cualquier foto para verla en grande.
          </p>
        </Reveal>
      </header>

      <Gallery photos={photos}>
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t, i) => (
            <ClipReveal
              key={t.src}
              from={t.from}
              delay={(i % 4) * 0.06}
              className={`h-44 overflow-hidden rounded-xl sm:h-52 md:h-60 ${
                t.wide ? "md:col-span-2" : ""
              } ${t.wideMobile ? "col-span-2" : ""}`}
            >
              <GalleryTile index={i} className="group">
                <Photo
                  src={t.src}
                  alt={t.alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
                />
              </GalleryTile>
            </ClipReveal>
          ))}
        </div>
      </Gallery>

      {/* Cierre honesto + CTA */}
      <Reveal className="mt-14 rounded-2xl border border-border bg-secondary/50 p-8 text-center sm:p-10">
        <h2 className="font-heading text-2xl font-semibold">
          ¿Te gustó lo que viste?
        </h2>
        <p className="mx-auto mt-2 max-w-xl leading-relaxed text-muted-foreground">
          Revisa la disponibilidad de tus fechas y reserva directo, sin
          comisiones. Cancela hasta 72 horas antes.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Button className="h-11 px-6" render={<Link href="/buscar" />}>
            Buscar disponibilidad
          </Button>
          <Button
            variant="secondary"
            className="h-11 px-6"
            render={<Link href="/habitaciones" />}
          >
            Ver habitaciones y tarifas
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
