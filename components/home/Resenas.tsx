import { Star, ArrowRight } from "lucide-react";
import { testimonios, site } from "@/lib/site";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={
            i < value
              ? "size-4 fill-primary text-primary"
              : "size-4 text-border"
          }
          aria-hidden
        />
      ))}
    </span>
  );
}

export function Resenas() {
  return (
    <section className="bg-secondary/40">
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 md:py-28">
        <Reveal className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold sm:text-4xl">
            Lo que dicen nuestros huéspedes
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Stars value={5} />
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">{site.reviewsRating}</strong> de
              5 · {site.reviewsTotal} reseñas en{" "}
              <a
                href={site.googleReviewsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Google
              </a>
            </span>
          </div>
        </Reveal>

        <Stagger className="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-3">
          {testimonios.map((t) => (
            <StaggerItem key={t.nombre}>
              <figure className="border-t border-border pt-6">
                <Stars value={t.rating} />
                <blockquote className="mt-3 leading-relaxed text-foreground/85">
                  {t.texto}
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                    {initials(t.nombre)}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{t.nombre}</span>
                    <span className="block text-xs text-muted-foreground">
                      Reseña de Google · {t.fecha}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal className="mt-12">
          <a
            href={site.googleReviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver todas las reseñas en Google
            <ArrowRight className="size-4" aria-hidden />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
