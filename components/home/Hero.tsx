import { Leaf, Check } from "lucide-react";
import { Photo } from "@/components/Photo";
import { BookingWidget } from "@/components/booking/BookingWidget";
import { heroImage } from "@/lib/images";
import { confianza } from "@/lib/site";
import { Parallax } from "@/components/motion/Parallax";
import { WordsReveal } from "@/components/motion/WordsReveal";
import { Reveal } from "@/components/motion/Reveal";

export function Hero() {
  return (
    <section
      id="reservar"
      className="relative isolate flex min-h-[100dvh] items-center overflow-hidden scroll-mt-20"
    >
      {/* Fondo: parallax al scroll + Ken Burns (zoom lento) */}
      <Parallax className="absolute inset-x-0 -top-[12%] -z-10 h-[124%]" speed={110}>
        <div className="kenburns absolute inset-0">
          <Photo
            src={heroImage}
            alt="Fachada del Hotel Magic Collinn al atardecer, en el centro de Axtla de Terrazas"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      </Parallax>
      {/* Overlay verde de marca, comprometido, para legibilidad AA */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand/90 via-brand/65 to-brand/90" />

      <div className="mx-auto w-full max-w-[1400px] px-4 pt-24 pb-16 sm:px-6">
        <div className="max-w-3xl">
          <Reveal direction="none" className="flex items-center gap-2 text-sm font-medium text-brand-foreground/90">
            <Leaf className="size-4 text-support" strokeWidth={1.75} aria-hidden />
            Hotel boutique en la Huasteca Potosina
          </Reveal>
          <h1 className="mt-4 font-heading text-5xl font-semibold leading-[1.0] text-white sm:text-6xl lg:text-[5.25rem]">
            <WordsReveal text="Tu estancia en Axtla de Terrazas" />
          </h1>
          <Reveal delay={0.55} className="mt-6 max-w-xl">
            <p className="text-lg leading-relaxed text-white/90 sm:text-xl">
              Hotel de 6 habitaciones en el centro. Reserva directo, sin
              intermediarios.
            </p>
          </Reveal>
        </div>

        <Reveal direction="scale" delay={0.7} className="mt-10 max-w-4xl">
          <BookingWidget />
        </Reveal>

        <Reveal delay={0.85} className="mt-4">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
            {confianza.map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <Check className="size-4 text-support" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
