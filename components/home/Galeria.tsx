import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { galeria } from "@/lib/images";
import { Photo } from "@/components/Photo";
import { Reveal } from "@/components/motion/Reveal";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Gallery, GalleryTile } from "@/components/gallery/Lightbox";

type From = "bottom" | "left" | "right" | "top";

// 8 imágenes con ritmo: 4 anchas (col-span-2) intercaladas → la cuadrícula
// de 4 columnas cierra en 3 filas exactas (2+2+4+4 = 12 spans).
const tiles: { src: string; alt: string; wide: boolean; from: From }[] = [
  { src: galeria[0], alt: "Corredor con arcos y plantas del Hotel Magic Collinn", wide: true, from: "left" },
  { src: galeria[1], alt: "Habitación doble del Hotel Magic Collinn", wide: false, from: "bottom" },
  { src: galeria[2], alt: "Habitación con cama matrimonial y climatización", wide: false, from: "bottom" },
  { src: galeria[3], alt: "Entrada principal del Hotel Magic Collinn en Axtla de Terrazas", wide: false, from: "bottom" },
  { src: galeria[4], alt: "Fachada y jardín del Hotel Magic Collinn", wide: true, from: "right" },
  { src: galeria[5], alt: "Habitación amplia con sala de estar", wide: false, from: "bottom" },
  { src: galeria[6], alt: "Entrada del Hotel Magic Collinn iluminada de noche", wide: true, from: "left" },
  { src: galeria[7], alt: "Habitación doble con sala de estar", wide: true, from: "right" },
];

// Versión grande de cada foto para el lightbox
const photos = tiles.map((t) => ({
  src: t.src.replace(/w=\d+/, "w=1600"),
  alt: t.alt,
}));

export function Galeria() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 md:py-28">
      <Reveal className="max-w-2xl">
        <h2 className="font-heading text-3xl font-semibold sm:text-4xl">
          Un vistazo a Magic Collinn
        </h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Un hotel sencillo y cuidado en la Huasteca Potosina, donde te sientes
          como en casa. Toca cualquier foto para verla en grande.
        </p>
        <Link
          href="/galeria"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver galería completa
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Reveal>

      <Gallery photos={photos}>
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t, i) => (
            <ClipReveal
              key={i}
              from={t.from}
              delay={i * 0.06}
              className={`h-44 overflow-hidden rounded-xl sm:h-52 md:h-60 ${
                t.wide ? "md:col-span-2" : ""
              }`}
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
    </section>
  );
}
