import { Quote } from "lucide-react";
import { testimonios } from "@/lib/site";
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

export function Resenas() {
  return (
    <section className="bg-secondary/40">
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 md:py-28">
        <Reveal className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold sm:text-4xl">
            Lo que dicen nuestros huéspedes
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Reservas directas, experiencias reales en el corazón de Axtla de
            Terrazas.
          </p>
        </Reveal>

        <Stagger className="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-3">
          {testimonios.map((t) => (
            <StaggerItem key={t.nombre}>
              <figure className="border-t border-border pt-6">
                <Quote className="size-7 text-support" aria-hidden />
                <blockquote className="mt-4 leading-relaxed text-foreground/85">
                  {t.texto}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                    {initials(t.nombre)}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{t.nombre}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.origen}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
