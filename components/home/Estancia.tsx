import { Tag, HeartHandshake, MapPin } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

const puntos = [
  {
    icon: Tag,
    title: "Sin comisiones",
    body: "Reservas directo con nosotros. Sin intermediarios ni cargos extra: la mejor tarifa es la nuestra.",
  },
  {
    icon: HeartHandshake,
    title: "Atención personalizada",
    body: "Somos pocas habitaciones, así que te conocemos por tu nombre y respondemos al instante por WhatsApp.",
  },
  {
    icon: MapPin,
    title: "En el corazón de Axtla",
    body: "A pasos de la plaza, los restaurantes y la salida hacia las cascadas de la Huasteca.",
  },
];

// Banda con sello propio: drenched en verde de marca, tipografía crema.
export function Estancia() {
  return (
    <section className="bg-brand text-brand-foreground">
      <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 md:py-32">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <Reveal direction="none">
            <p className="flex items-center gap-2 text-sm font-medium text-support">
              Por qué reservar directo
            </p>
            <h2 className="mt-4 max-w-2xl font-heading text-4xl font-semibold leading-[1.04] text-brand-foreground sm:text-5xl lg:text-6xl">
              Un hotel pequeño, una atención enorme
            </h2>
          </Reveal>
          <Reveal direction="up" delay={0.15}>
            <p className="text-lg leading-relaxed text-brand-foreground/80">
              Seis habitaciones en el centro de Axtla de Terrazas. Eso significa
              trato cercano, respuestas rápidas y la tranquilidad de reservar
              directo, sin sorpresas.
            </p>
          </Reveal>
        </div>

        <Stagger className="mt-16 grid gap-x-10 gap-y-10 sm:grid-cols-3">
          {puntos.map((p) => {
            const Icon = p.icon;
            return (
              <StaggerItem key={p.title}>
                <div className="border-t border-brand-foreground/20 pt-6">
                  <Icon
                    className="size-6 text-support"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <h3 className="mt-4 font-heading text-xl font-semibold text-brand-foreground">
                    {p.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-brand-foreground/75">
                    {p.body}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
