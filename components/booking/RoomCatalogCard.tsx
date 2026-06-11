import Link from "next/link";
import { Users, Check, ArrowRight } from "lucide-react";
import { Photo } from "@/components/Photo";
import { formatMXN } from "@/lib/booking/engine";
import { Button } from "@/components/ui/button";

interface Props {
  slug: string;
  nombre: string;
  descripcion: string;
  capacidad: number;
  tarifaBase: number;
  amenidades: string[];
  fotos: string[];
}

// Tarjeta de catálogo (sin fechas): muestra la habitación e invita a elegir
// fechas en el buscador. Mismo lenguaje visual que RoomResultCard.
export function RoomCatalogCard({
  slug,
  nombre,
  descripcion,
  capacidad,
  tarifaBase,
  amenidades,
  fotos,
}: Props) {
  return (
    <article className="group grid overflow-hidden rounded-2xl border border-border bg-card transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover-hover:-translate-y-1 hover-hover:shadow-lg hover-hover:shadow-brand/5 md:grid-cols-[300px_1fr]">
      <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto">
        <Photo
          src={fotos[0]}
          alt={`${nombre}, Hotel Magic Collinn`}
          fill
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
        />
      </div>

      <div className="flex flex-col gap-4 p-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-heading text-xl font-semibold">{nombre}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" aria-hidden /> Hasta {capacidad}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {descripcion}
          </p>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {amenidades.slice(0, 5).map((a) => (
            <li
              key={a}
              className="inline-flex items-center gap-1.5 text-xs text-foreground/70"
            >
              <Check className="size-3.5 text-support" aria-hidden /> {a}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Desde{" "}
            <span className="text-2xl font-semibold text-primary">
              {formatMXN(tarifaBase)}
            </span>{" "}
            / noche
          </p>
          <Button
            className="h-11 gap-1.5 px-6"
            render={<Link href={`/buscar?tipo=${slug}#buscador`} />}
          >
            Reservar
            <ArrowRight
              className="size-4 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5"
              aria-hidden
            />
          </Button>
        </div>
      </div>
    </article>
  );
}
