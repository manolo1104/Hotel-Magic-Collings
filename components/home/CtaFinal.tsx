import Image from "next/image";
import Link from "next/link";
import { galeria } from "@/lib/images";
import { Button } from "@/components/ui/button";
import { Parallax } from "@/components/motion/Parallax";
import { WordsReveal } from "@/components/motion/WordsReveal";
import { Reveal } from "@/components/motion/Reveal";
import { MagneticButton } from "@/components/motion/MagneticButton";

export function CtaFinal() {
  return (
    <section className="relative isolate overflow-hidden">
      <Parallax className="absolute inset-x-0 -top-[15%] -z-10 h-[130%]" speed={90}>
        <div className="kenburns absolute inset-0">
          <Image
            src={galeria[1]}
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
      </Parallax>
      <div className="absolute inset-0 -z-10 bg-brand/85" />

      <div className="mx-auto max-w-[1400px] px-4 py-20 text-center sm:px-6 md:py-28">
        <h2 className="mx-auto max-w-2xl font-heading text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
          <WordsReveal
            text="¿Listo para tu escapada a la Huasteca?"
            trigger="inView"
          />
        </h2>
        <Reveal delay={0.2} className="mx-auto mt-4 max-w-xl">
          <p className="leading-relaxed text-white/85">
            Consulta disponibilidad y reserva directo. Te confirmamos por WhatsApp
            en menos de 24 horas.
          </p>
        </Reveal>
        <Reveal delay={0.35} direction="scale" className="mt-8">
          <MagneticButton>
            <Button
              className="h-12 px-8 text-base"
              render={<Link href="/buscar" />}
            >
              Buscar disponibilidad
            </Button>
          </MagneticButton>
        </Reveal>
      </div>
    </section>
  );
}
