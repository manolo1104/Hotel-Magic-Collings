import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SearchX, Star, CalendarDays, ClipboardList, MessageCircle } from "lucide-react";
import { getAvailability, getRoomTypes } from "@/lib/booking/engine";
import { site } from "@/lib/site";
import { BookingWidget } from "@/components/booking/BookingWidget";
import { BookingSteps } from "@/components/booking/BookingSteps";
import { RoomResultCard } from "@/components/booking/RoomResultCard";
import { RoomCatalogCard } from "@/components/booking/RoomCatalogCard";
import { Reveal } from "@/components/motion/Reveal";
import { WordsReveal } from "@/components/motion/WordsReveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

export const metadata: Metadata = {
  title: "Reservar",
  description:
    "Consulta la disponibilidad de habitaciones del Hotel Magic Collinn en Axtla de Terrazas y reserva directo.",
  robots: { index: false },
};

type SP = Promise<{ [key: string]: string | string[] | undefined }>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function fmt(iso: string): string {
  try {
    return format(new Date(`${iso}T12:00:00`), "d 'de' MMMM", { locale: es });
  } catch {
    return iso;
  }
}

export default async function BuscarPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const checkin = one(sp.checkin);
  const checkout = one(sp.checkout);
  const huespedes = Math.max(1, Number(one(sp.huespedes) || "2"));
  const tipoParam = one(sp.tipo);
  const hasDates = Boolean(checkin && checkout);

  const result = hasDates
    ? await getAvailability({ checkin, checkout, huespedes })
    : null;
  // Sin fechas: catálogo completo de habitaciones para no dejar la página vacía.
  const catalogo = hasDates ? [] : await getRoomTypes();

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-28 pb-20 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
          <WordsReveal text="Reserva tu habitación" />
        </h1>
        {hasDates && result?.ok ? (
          <p className="mt-2 text-muted-foreground">
            Del <strong className="text-foreground">{fmt(checkin)}</strong> al{" "}
            <strong className="text-foreground">{fmt(checkout)}</strong> ·{" "}
            {huespedes} {huespedes === 1 ? "huésped" : "huéspedes"} ·{" "}
            {result.noches} {result.noches === 1 ? "noche" : "noches"}
          </p>
        ) : (
          <p className="mt-2 text-muted-foreground">
            Elige tus fechas y número de huéspedes para ver las habitaciones
            disponibles.
          </p>
        )}
        <a
          href={site.googleReviewsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Star className="size-4 fill-primary text-primary" aria-hidden />
          <strong className="font-semibold text-foreground">
            {site.reviewsRating}
          </strong>
          · {site.reviewsTotal} reseñas en Google
        </a>
      </header>

      <BookingSteps current={1} className="mt-7" />

      <div id="buscador" className="scroll-mt-24">
        <BookingWidget
          className="mt-6 max-w-4xl"
          initialCheckin={checkin || undefined}
          initialCheckout={checkout || undefined}
          initialHuespedes={huespedes}
          tipo={tipoParam || undefined}
        />
      </div>

      <div className="mt-10">
        {!hasDates && (
          <div>
            <Reveal>
              <h2 className="font-heading text-2xl font-semibold">
                Nuestras habitaciones
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Elige tus fechas arriba para ver la disponibilidad y el precio
                total de tu estancia.
              </p>
            </Reveal>
            <Stagger className="mt-6 grid gap-5">
              {catalogo.map((t) => (
                <StaggerItem key={t.id}>
                  <RoomCatalogCard
                    slug={t.slug}
                    nombre={t.nombre}
                    descripcion={t.descripcion}
                    capacidad={t.capacidad}
                    tarifaBase={t.tarifaBase}
                    amenidades={t.amenidades}
                    fotos={t.fotos}
                  />
                </StaggerItem>
              ))}
            </Stagger>

            {/* Cómo funciona: aclara el flujo sin pago en línea */}
            <div className="mt-16">
              <Reveal>
                <h2 className="font-heading text-2xl font-semibold">
                  Cómo funciona
                </h2>
              </Reveal>
              <Stagger className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-3">
                <StaggerItem>
                  <div className="border-t border-border pt-5">
                    <CalendarDays className="size-6 text-support" strokeWidth={1.75} aria-hidden />
                    <h3 className="mt-3 font-heading text-base font-semibold">
                      Elige fechas y habitación
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      Consulta la disponibilidad real al momento.
                    </p>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="border-t border-border pt-5">
                    <ClipboardList className="size-6 text-support" strokeWidth={1.75} aria-hidden />
                    <h3 className="mt-3 font-heading text-base font-semibold">
                      Completa tus datos
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      Un minuto y listo, sin pago en línea.
                    </p>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="border-t border-border pt-5">
                    <MessageCircle className="size-6 text-support" strokeWidth={1.75} aria-hidden />
                    <h3 className="mt-3 font-heading text-base font-semibold">
                      Te confirmamos por WhatsApp
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      En menos de 24 horas, y pagas al llegar al hotel.
                    </p>
                  </div>
                </StaggerItem>
              </Stagger>
            </div>
          </div>
        )}

        {hasDates && result && !result.ok && (
          <EmptyHint
            icon={<SearchX className="size-6" aria-hidden />}
            title="Revisa las fechas"
            body={result.error ?? "No pudimos procesar la búsqueda."}
          />
        )}

        {hasDates && result?.ok && result.tipos.length === 0 && (
          <EmptyHint
            icon={<SearchX className="size-6" aria-hidden />}
            title="Sin disponibilidad para esas fechas"
            body="No tenemos habitaciones libres en ese rango. Prueba con otras fechas o escríbenos por WhatsApp."
          />
        )}

        {hasDates && result?.ok && result.tipos.length > 0 && (
          <Stagger className="grid gap-5">
            {result.tipos.map((t) => (
              <StaggerItem key={t.id}>
                <RoomResultCard
                  tipo={t}
                  checkin={checkin}
                  checkout={checkout}
                  huespedes={huespedes}
                  highlighted={Boolean(tipoParam) && tipoParam === t.slug}
                />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}

function EmptyHint({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Reveal direction="scale" className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h2 className="mt-4 font-heading text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      <Link
        href="/contacto"
        className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Contáctanos por WhatsApp
      </Link>
    </Reveal>
  );
}
