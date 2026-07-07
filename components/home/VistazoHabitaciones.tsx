import Link from "next/link";
import { Photo } from "@/components/Photo";
import { Users, ArrowRight, Check } from "lucide-react";
import { getRoomTypes } from "@/lib/booking/engine";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Precio } from "@/components/Precio";
import { Button } from "@/components/ui/button";

export async function VistazoHabitaciones() {
  const tipos = await getRoomTypes();

  return (
    <section className="bg-secondary/40">
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 md:py-28">
        <Reveal className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold sm:text-4xl">
            Habitaciones para cada viaje
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Seis habitaciones repartidas en dos categorías (sencilla y doble),
            climatizadas y cómodas. Elige la que mejor se ajuste a tu estancia.
          </p>
        </Reveal>

        <Stagger className="mt-10 grid gap-6 md:grid-cols-2">
          {tipos.map((t) => (
            <StaggerItem key={t.id} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover-hover:-translate-y-1.5 hover-hover:shadow-xl hover-hover:shadow-brand/5">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Photo
                    src={t.fotos[0]}
                    alt={`${t.nombre}, Hotel Magic Collinn`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-heading text-xl font-semibold">
                      {t.nombre}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Users className="size-3.5" aria-hidden /> Hasta{" "}
                      {t.capacidad}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {t.descripcion}
                  </p>

                  {/* Amenidades clave */}
                  <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
                    {t.amenidades.slice(0, 3).map((a) => (
                      <li
                        key={a}
                        className="inline-flex items-center gap-1.5 text-xs text-foreground/70"
                      >
                        <Check className="size-3.5 shrink-0 text-support" aria-hidden />
                        {a}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                    <p className="text-sm text-muted-foreground">
                      {t.tarifaBase > 0 ? (
                        <>
                          Desde{" "}
                          <Precio
                            value={t.tarifaBase}
                            className="text-lg font-semibold text-primary"
                          />{" "}
                          / noche
                        </>
                      ) : (
                        <Precio
                          value={t.tarifaBase}
                          className="text-lg font-semibold text-primary"
                        />
                      )}
                    </p>
                    <div className="flex flex-col items-end gap-1.5">
                      <Button
                        className="gap-1.5"
                        render={<Link href={`/buscar?tipo=${t.slug}`} />}
                      >
                        Reservar
                        <ArrowRight className="size-4 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5" aria-hidden />
                      </Button>
                      <Link
                        href="/habitaciones"
                        className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        Ver detalles y fotos
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
