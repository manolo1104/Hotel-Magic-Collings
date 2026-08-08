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
  description: `Fotos reales del ${site.legalName} en ${site.locality}: fachada, corredor de arcos, habitaciones King Size y Doble Queen, y la Suite. Así se ve el hotel que vas a reservar.`,
  alternates: { canonical: "/galeria" },
};

type From = "bottom" | "left" | "right" | "top";

// Las 24 fotos reales del hotel (public/imagenes/), con ritmo de anchas.
// CUADRÍCULA: en md:grid-cols-4 los spans suman 32 (24 fotos + 8 anchas) → 8
// filas exactas, sin huecos. En móvil (2 columnas) solo 2 son anchas → 26
// spans = 13 filas parejas. Si agregas o quitas fotos, rehaz esta cuenta.
const tiles: {
  src: string;
  alt: string;
  wide?: boolean;
  wideMobile?: boolean;
  from: From;
}[] = [
  // Exteriores y áreas comunes
  { src: "/imagenes/fachada-jardin.jpg", alt: "Fachada y jardín del Hotel Magic Collinn", wide: true, wideMobile: true, from: "left" },
  { src: "/imagenes/corredor-arcos-jardin.jpg", alt: "Corredor de arcos amarillos con plantas y vista al jardín", wide: true, from: "right" },
  { src: "/imagenes/fachada-esquina.jpg", alt: "Fachada del hotel en la esquina de Francisco I. Madero, Axtla de Terrazas", from: "bottom" },
  { src: "/imagenes/entrada-noche.jpg", alt: "Entrada del hotel iluminada de noche", wide: true, from: "left" },
  { src: "/imagenes/porche-plantas.jpg", alt: "Pórtico del hotel lleno de plantas colgantes", from: "bottom" },
  { src: "/imagenes/corredor-habitaciones.jpg", alt: "Corredor con acceso a las habitaciones y sillones de descanso", from: "bottom" },
  { src: "/imagenes/patio-empedrado.jpg", alt: "Patio empedrado del hotel con setos recortados", wide: true, from: "right" },
  { src: "/imagenes/fachada-calle.jpg", alt: "Entrada del Hotel Magic Collinn desde la calle", from: "bottom" },
  // Habitación King Size
  { src: "/imagenes/king-2.jpg", alt: "Habitación King Size con salita, pantalla y salida al balcón", wide: true, from: "left" },
  { src: "/imagenes/king-1.jpg", alt: "Cama King Size con cabecera de ratán en la habitación King", from: "bottom" },
  { src: "/imagenes/king-3.jpg", alt: "Habitación King Size con clóset y tocador", from: "bottom" },
  // Habitación Matrimonial
  { src: "/imagenes/matrimonial-1.jpg", alt: "Habitación Matrimonial con tocador y espejo", from: "bottom" },
  { src: "/imagenes/matrimonial-2.jpg", alt: "Habitación Matrimonial con pantalla y salida al balcón", from: "bottom" },
  { src: "/imagenes/matrimonial-3.jpg", alt: "Detalle de la habitación Matrimonial con clóset", from: "bottom" },
  // Habitación Doble Queen
  { src: "/imagenes/doble-queen-2.jpg", alt: "Habitación Doble Queen con dos camas Queen Size y tocador", wide: true, from: "right" },
  { src: "/imagenes/doble-queen-1.jpg", alt: "Habitación Doble Queen con dos camas y pantalla", from: "bottom" },
  { src: "/imagenes/doble-queen-3.jpg", alt: "Habitación Doble Queen con salita y salida al corredor", from: "bottom" },
  { src: "/imagenes/doble-queen-4.jpg", alt: "Habitación Doble Queen amplia con sofá", from: "bottom" },
  { src: "/imagenes/doble-queen-5.jpg", alt: "Habitación Doble Queen con dos camas y tocador", from: "bottom" },
  { src: "/imagenes/doble-queen-7.jpg", alt: "Habitación Doble Queen, vista general", from: "bottom" },
  { src: "/imagenes/doble-queen-8.jpg", alt: "Habitación Doble Queen con sala de estar", from: "bottom" },
  // Departamento
  { src: "/imagenes/depa-matrimonial-2.jpg", alt: "Recámara de la Suite con dos camas matrimoniales", wide: true, from: "left" },
  { src: "/imagenes/depa-queen-1.jpg", alt: "Recámara de la Suite con cama Queen Size", wide: true, wideMobile: true, from: "right" },
  { src: "/imagenes/patio-estacionamiento.jpg", alt: "Patio con estacionamiento techado del hotel", from: "bottom" },
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
            Fotos reales de {site.name}: la fachada, el corredor de arcos,
            nuestras habitaciones King Size y Doble Queen, y la Suite. Lo que
            ves es lo que te recibe. Toca cualquier foto para verla en grande.
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
          comisiones. Reembolso del 100% si cancelas con 7 días o más.
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
