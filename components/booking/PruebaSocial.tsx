import { Star, Quote, ShieldCheck } from "lucide-react";
import { site, testimonios, confianza } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

// Prueba social para el embudo de reserva (/buscar): rating real de Google +
// garantías + 3 testimonios reales. La confianza cerca del momento de decisión
// es el factor #1 de conversión. Datos desde lib/site.ts (una sola verdad).
const DESTACADOS = [testimonios[1], testimonios[4], testimonios[5]].filter(
  Boolean,
);

export function PruebaSocial({ className }: { className?: string }) {
  return (
    <section className={cn("border-t border-border pt-12", className)}>
      <Reveal>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-3xl font-semibold text-foreground">
                {site.reviewsRating}
              </span>
              <span className="flex gap-0.5 text-primary" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </span>
            </div>
            <a
              href={site.googleReviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {site.reviewsTotal} reseñas reales en Google
            </a>
          </div>
          <ul className="flex flex-col gap-2 sm:items-end">
            {confianza.map((c) => (
              <li
                key={c}
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <ShieldCheck className="size-4 shrink-0 text-support" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Stagger className="mt-8 grid gap-4 md:grid-cols-3">
        {DESTACADOS.map((t) => (
          <StaggerItem key={t.nombre}>
            <figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
              <Quote className="size-5 text-primary/40" aria-hidden />
              <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {t.texto}
              </blockquote>
              <figcaption className="mt-3 flex items-center gap-2 text-xs">
                <span className="font-medium text-foreground">{t.nombre}</span>
                <span className="flex gap-0.5 text-primary" aria-hidden>
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="size-3 fill-current" />
                  ))}
                </span>
              </figcaption>
            </figure>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
