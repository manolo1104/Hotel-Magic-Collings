import { Fragment } from "react";
import { Leaf, Check } from "lucide-react";
import { Photo } from "@/components/Photo";
import { BookingWidget } from "@/components/booking/BookingWidget";
import { heroImage } from "@/lib/images";
import { confianza } from "@/lib/site";
import { Parallax } from "@/components/motion/Parallax";
import { RatingBadge } from "@/components/RatingBadge";

// El titular es el elemento LCP: se anima por CSS (no por JS) para que aparezca
// en el primer pintado incluso en móvil lento. El resto del sitio usa motion.
const titulo = "Tu estancia en Axtla de Terrazas".split(" ");

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
            alt="Fachada y jardín del Hotel Magic Collinn, en el centro de Axtla de Terrazas"
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
          <p
            className="anim-in-fade flex items-center gap-2 text-sm font-medium text-brand-foreground/90"
            style={{ animationDelay: "0.05s" }}
          >
            <Leaf className="size-4 text-support" strokeWidth={1.75} aria-hidden />
            Hotel boutique en la Huasteca Potosina
          </p>
          <h1 className="mt-4 font-heading text-5xl font-semibold leading-[1.0] text-white sm:text-6xl lg:text-[5.25rem]">
            {titulo.map((w, i) => (
              <Fragment key={i}>
                <span
                  className="anim-in inline-block pb-[0.08em]"
                  style={{ animationDelay: `${0.12 + i * 0.06}s` }}
                >
                  {w}
                </span>
                {i < titulo.length - 1 ? " " : ""}
              </Fragment>
            ))}
          </h1>
          <p
            className="anim-in mt-6 max-w-xl text-lg leading-relaxed text-white/90 sm:text-xl"
            style={{ animationDelay: "0.5s" }}
          >
            Hotel de 6 habitaciones en el centro. Reserva directo, sin
            intermediarios.
          </p>
        </div>

        <div className="anim-in mt-10 max-w-4xl" style={{ animationDelay: "0.62s" }}>
          <BookingWidget />
        </div>

        <div
          className="anim-in mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5"
          style={{ animationDelay: "0.74s" }}
        >
          <RatingBadge tone="onDark" />
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
            {confianza.map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <Check className="size-4 text-support" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
