import { ShieldCheck, CalendarClock, MessageCircle } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

// Propuesta de valor de la reserva directa. Es el bloque con mayor lift de
// conversión documentado, por eso va inmediatamente después del hero y no se
// entierra. Todo aquí es verídico (política real del hotel).
const valores = [
  {
    icon: ShieldCheck,
    title: "Mejor precio directo",
    desc: "Reservando aquí evitas comisiones de intermediarios.",
  },
  {
    icon: CalendarClock,
    title: "Cancela gratis hasta 72 h antes",
    desc: "Con reembolso o cambio de fechas, sin complicaciones.",
  },
  {
    icon: MessageCircle,
    title: "Confirmación por WhatsApp",
    desc: "Te confirmamos en menos de 24 h, con trato directo.",
  },
];

export function BarraValor() {
  return (
    <section
      aria-label="Ventajas de reservar directo"
      className="border-y border-border bg-card"
    >
      <Stagger className="mx-auto grid max-w-[1400px] gap-px px-4 py-8 sm:grid-cols-3 sm:gap-8 sm:px-6 md:py-10">
        {valores.map((v) => {
          const Icon = v.icon;
          return (
            <StaggerItem key={v.title}>
              <div className="flex items-start gap-3.5">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <p className="font-heading text-base font-semibold leading-snug">
                    {v.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {v.desc}
                  </p>
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
