import Link from "next/link";
import { Photo } from "@/components/Photo";
import { Users, Check } from "lucide-react";
import type { AvailableRoomType } from "@/lib/booking/types";
import { formatMXN } from "@/lib/booking/engine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  tipo: AvailableRoomType;
  checkin: string;
  checkout: string;
  huespedes: number;
  highlighted?: boolean;
}

export function RoomResultCard({
  tipo,
  checkin,
  checkout,
  huespedes,
  highlighted,
}: Props) {
  const reservarHref = `/reservar?${new URLSearchParams({
    tipo: tipo.slug,
    checkin,
    checkout,
    huespedes: String(huespedes),
  }).toString()}`;

  return (
    <article
      className={cn(
        "group grid overflow-hidden rounded-2xl border bg-card transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover-hover:-translate-y-1 hover-hover:shadow-lg hover-hover:shadow-brand/5 md:grid-cols-[300px_1fr]",
        highlighted ? "border-primary ring-1 ring-primary/30" : "border-border",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto">
        <Photo
          src={tipo.fotos[0]}
          alt={`${tipo.nombre}, Hotel Magic Collinn`}
          fill
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
        />
      </div>

      <div className="flex flex-col gap-4 p-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-heading text-xl font-semibold">{tipo.nombre}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" aria-hidden /> Hasta {tipo.capacidad}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {tipo.descripcion}
          </p>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {tipo.amenidades.slice(0, 5).map((a) => (
            <li
              key={a}
              className="inline-flex items-center gap-1.5 text-xs text-foreground/70"
            >
              <Check className="size-3.5 text-support" aria-hidden /> {a}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
          <div>
            <p className="text-2xl font-semibold text-primary">
              {formatMXN(tipo.precioTotal)}
            </p>
            <p className="text-xs text-muted-foreground">
              {/* precioNoche, no tarifaBase: el hotel cobra según cuánta
                  gente entra, y aquí ya sabemos cuántos son. */}
              {tipo.noches} {tipo.noches === 1 ? "noche" : "noches"} ·{" "}
              {formatMXN(tipo.precioNoche)} / noche
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {/* Urgencia honesta: ámbar solo cuando el inventario real es bajo */}
            <span
              className={
                tipo.disponibles === 1
                  ? "text-xs font-semibold text-amber-700"
                  : tipo.disponibles <= 2
                    ? "text-xs font-medium text-amber-700"
                    : "text-xs font-medium text-support-foreground/80"
              }
            >
              {tipo.disponibles === 1
                ? "Última habitación disponible"
                : `${tipo.disponibles} disponibles`}
            </span>
            <Button className="h-11 px-6" render={<Link href={reservarHref} />}>
              Reservar
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
