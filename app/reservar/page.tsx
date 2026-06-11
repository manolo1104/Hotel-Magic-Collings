import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Photo } from "@/components/Photo";
import { es } from "date-fns/locale";
import { CalendarX, Check } from "lucide-react";
import { confianza } from "@/lib/site";
import { getAvailability, formatMXN } from "@/lib/booking/engine";
import { BookingForm } from "@/components/booking/BookingForm";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";
import { WordsReveal } from "@/components/motion/WordsReveal";
import { CountUp } from "@/components/motion/CountUp";

export const metadata: Metadata = {
  title: "Reservar",
  description: "Completa tu reserva directa en el Hotel Magic Collinn.",
  robots: { index: false },
};

type SP = Promise<{ [key: string]: string | string[] | undefined }>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}
function fmt(iso: string): string {
  try {
    return format(new Date(`${iso}T12:00:00`), "EEE d 'de' MMM", { locale: es });
  } catch {
    return iso;
  }
}

function Aviso({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarX className="size-6" aria-hidden />
      </div>
      <h1 className="mt-4 font-heading text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Button className="mt-5 h-11 px-6" render={<Link href={href} />}>
        {cta}
      </Button>
    </div>
  );
}

export default async function ReservarPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tipoSlug = one(sp.tipo);
  const checkin = one(sp.checkin);
  const checkout = one(sp.checkout);
  const huespedes = Math.max(1, Number(one(sp.huespedes) || "2"));

  if (!tipoSlug || !checkin || !checkout) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-28 pb-20 sm:px-6">
        <Aviso
          title="Falta información de la reserva"
          body="Empieza por elegir tus fechas y la habitación que quieres reservar."
          href="/#reservar"
          cta="Buscar disponibilidad"
        />
      </div>
    );
  }

  const result = await getAvailability({ checkin, checkout, huespedes });
  const tipo = result.ok ? result.tipos.find((t) => t.slug === tipoSlug) : undefined;

  if (!tipo) {
    const back = `/buscar?${new URLSearchParams({ checkin, checkout, huespedes: String(huespedes) }).toString()}`;
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-28 pb-20 sm:px-6">
        <Aviso
          title="Esa habitación ya no está disponible"
          body="Puede que se haya reservado para esas fechas. Vuelve a ver las opciones disponibles."
          href={back}
          cta="Ver disponibilidad"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-28 pb-20 sm:px-6">
      <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
        <WordsReveal text="Confirma tu reserva" />
      </h1>
      <Reveal delay={0.25} className="mt-2">
        <p className="text-muted-foreground">
          Estás a un paso. Revisa los datos y completa la reserva.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        {/* Resumen */}
        <aside className="overflow-hidden rounded-2xl border border-border bg-card lg:sticky lg:top-24">
          <div className="relative aspect-[16/10]">
            <Photo
              src={tipo.fotos[0]}
              alt={`${tipo.nombre}, Hotel Magic Collinn`}
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
          </div>
          <div className="p-6">
            <h2 className="font-heading text-xl font-semibold">{tipo.nombre}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Llegada</dt>
                <dd className="font-medium">{fmt(checkin)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Salida</dt>
                <dd className="font-medium">{fmt(checkout)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Huéspedes</dt>
                <dd className="font-medium">{huespedes}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {tipo.noches} {tipo.noches === 1 ? "noche" : "noches"} ×{" "}
                  {formatMXN(tipo.tarifaBase)}
                </dt>
                <dd className="font-medium">{formatMXN(tipo.precioTotal)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="font-medium">Total</span>
              <CountUp
                value={tipo.precioTotal}
                prefix="$"
                suffix=" MXN"
                className="font-heading text-2xl font-semibold text-primary"
              />
            </div>
            <ul className="mt-4 space-y-2 border-t border-border pt-4">
              {confianza.map((c) => (
                <li
                  key={c}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Check className="size-3.5 shrink-0 text-support" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Formulario */}
        <Reveal direction="right" delay={0.1}>
          <BookingForm
            slug={tipo.slug}
            nombre={tipo.nombre}
            checkin={checkin}
            checkout={checkout}
            huespedes={huespedes}
          />
        </Reveal>
      </div>
    </div>
  );
}
