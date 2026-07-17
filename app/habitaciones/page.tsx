import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/Photo";
import { Users, Check, ArrowRight } from "lucide-react";
import { getRoomTypes } from "@/lib/booking/engine";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";
import { WordsReveal } from "@/components/motion/WordsReveal";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Gallery, GalleryTile } from "@/components/gallery/Lightbox";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Precio } from "@/components/Precio";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd, roomsJsonLd } from "@/lib/seo";
import { fotosExtraPorSlug } from "@/lib/images";

// ISR: se prerenderiza y revalida cada 10 min (tarifas/tipos cambian rara vez).
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Habitaciones y tarifas en Axtla de Terrazas",
  description:
    "Conoce las habitaciones del Hotel Magic Collinn en Axtla de Terrazas: sencillas y dobles, climatizadas, con estacionamiento. Reserva directa.",
  alternates: { canonical: "/habitaciones" },
};

export default async function HabitacionesPage() {
  const tipos = await getRoomTypes();

  return (
    <div className="pt-28 pb-20">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: "/" },
          { name: "Habitaciones", url: "/habitaciones" },
        ])}
      />
      <JsonLd data={roomsJsonLd(tipos)} />

      <header className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <h1 className="max-w-2xl font-heading text-4xl font-semibold sm:text-5xl">
          <WordsReveal text="Nuestras habitaciones" />
        </h1>
        <Reveal delay={0.3} className="mt-4 max-w-xl">
          <p className="leading-relaxed text-muted-foreground">
            Seis habitaciones boutique en dos categorías (sencilla y doble), en
            el centro de Axtla de Terrazas. Elige la tuya y reserva directo, sin
            comisiones.
          </p>
        </Reveal>
      </header>

      <div className="mx-auto mt-14 flex max-w-[1400px] flex-col gap-20 px-4 sm:px-6">
        {tipos.map((t, i) => {
          const flip = i % 2 === 1;
          // Fotos de BD + extras locales (el grid muestra 3; el lightbox, todas)
          const fotos = [...t.fotos, ...(fotosExtraPorSlug[t.slug] ?? [])];
          const fotosLb = fotos.map((f, j) => ({
            src: f.replace(/w=\d+/, "w=1600"),
            alt:
              j === 0
                ? `${t.nombre}, vista principal`
                : `${t.nombre}, detalle ${j}`,
          }));
          return (
            <section
              key={t.id}
              id={t.slug}
              className="grid scroll-mt-24 items-center gap-8 lg:grid-cols-2 lg:gap-12"
            >
              {/* Galería (clic para ampliar) */}
              <Gallery photos={fotosLb}>
                <div className={`grid grid-cols-2 gap-3 ${flip ? "lg:order-2" : ""}`}>
                  <ClipReveal
                    from={flip ? "right" : "left"}
                    className="col-span-2 aspect-[16/10] overflow-hidden rounded-2xl"
                  >
                    <GalleryTile index={0} className="group">
                      <Photo
                        src={fotos[0]}
                        alt={`${t.nombre}, vista principal`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 45vw"
                        className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
                      />
                    </GalleryTile>
                  </ClipReveal>
                  {fotos.slice(1, 3).map((f, j) => (
                    <ClipReveal
                      key={j}
                      delay={0.1 + j * 0.1}
                      className="aspect-square overflow-hidden rounded-xl"
                    >
                      <GalleryTile index={j + 1} className="group relative">
                        <Photo
                          src={f}
                          alt={`${t.nombre}, detalle ${j + 1}`}
                          fill
                          sizes="(max-width: 1024px) 50vw, 22vw"
                          className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
                        />
                        {/* Aviso de fotos adicionales en el lightbox */}
                        {j === 1 && fotos.length > 3 && (
                          <span className="absolute right-2 bottom-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
                            +{fotos.length - 3} fotos
                          </span>
                        )}
                      </GalleryTile>
                    </ClipReveal>
                  ))}
                </div>
              </Gallery>

              {/* Contenido */}
              <Stagger className="flex flex-col gap-0">
                <StaggerItem className="flex flex-wrap items-center gap-3">
                  <h2 className="font-heading text-2xl font-semibold sm:text-3xl">
                    {t.nombre}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <Users className="size-3.5" aria-hidden /> Hasta {t.capacidad}{" "}
                    personas
                  </span>
                </StaggerItem>

                <StaggerItem className="mt-4">
                  <p className="leading-relaxed text-muted-foreground">
                    {t.descripcion}
                  </p>
                </StaggerItem>

                <StaggerItem className="mt-6">
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {t.amenidades.map((a) => (
                      <li
                        key={a}
                        className="inline-flex items-center gap-2 text-sm text-foreground/80"
                      >
                        <Check className="size-4 text-support" aria-hidden /> {a}
                      </li>
                    ))}
                  </ul>
                </StaggerItem>

                <StaggerItem className="mt-8">
                  <div className="group flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                    <p className="text-sm text-muted-foreground">
                      {t.tarifaBase > 0 ? (
                        <>
                          Desde{" "}
                          <Precio
                            value={t.tarifaBase}
                            className="text-2xl font-semibold text-primary"
                          />{" "}
                          / noche
                        </>
                      ) : (
                        <Precio
                          value={t.tarifaBase}
                          className="text-2xl font-semibold text-primary"
                        />
                      )}
                    </p>
                    <Button
                      className="h-11 gap-2 px-6"
                      render={<Link href={`/buscar?tipo=${t.slug}`} />}
                    >
                      Reservar
                      <ArrowRight
                        className="size-4 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Button>
                  </div>
                </StaggerItem>
              </Stagger>
            </section>
          );
        })}
      </div>
    </div>
  );
}
