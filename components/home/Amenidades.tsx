import { Snowflake, Car, MapPin, HeartHandshake, type LucideIcon } from "lucide-react";
import { amenities } from "@/lib/site";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

const icons: Record<string, LucideIcon> = {
  Snowflake,
  Car,
  MapPin,
  HeartHandshake,
};

export function Amenidades() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 md:py-28">
      <Reveal className="max-w-2xl">
        <h2 className="font-heading text-3xl font-semibold sm:text-4xl">
          Todo lo que necesitas para descansar
        </h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Comodidades pensadas para una estancia tranquila a pasos del centro de
          Axtla de Terrazas.
        </p>
      </Reveal>

      <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {amenities.map((a) => {
          const Icon = icons[a.icon] ?? MapPin;
          return (
            <StaggerItem key={a.title} className="h-full">
              <div className="group h-full rounded-2xl border border-border bg-card p-6 transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover-hover:-translate-y-1 hover-hover:shadow-lg hover-hover:shadow-brand/5">
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-support/15 text-brand transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-110 group-hover:rotate-3">
                  <Icon className="size-6" strokeWidth={1.75} aria-hidden />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold">
                  {a.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {a.desc}
                </p>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
