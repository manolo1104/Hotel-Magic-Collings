import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Star } from "lucide-react";
import { site, waLink, testimonios } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/Photo";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd, hotelJsonLd } from "@/lib/seo";
import { Reveal } from "@/components/motion/Reveal";
import { WordsReveal } from "@/components/motion/WordsReveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

export const metadata: Metadata = {
  title: "Nosotros: un hotel familiar en Axtla de Terrazas",
  description: `${site.name} es un hotel familiar de ${site.rooms} habitaciones en el centro de ${site.locality}, atendido en persona por sus dueños. Conócenos antes de tu viaje a la Huasteca.`,
  alternates: { canonical: "/nosotros" },
};

// Borrador honesto: solo datos confirmados (habitaciones, ubicación, trato que
// citan las reseñas). La historia del hotel la enriquecerá el dueño.
export default function NosotrosPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-28 pb-20 sm:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: "/" },
          { name: "Nosotros", url: "/nosotros" },
        ])}
      />
      <JsonLd data={hotelJsonLd()} />

      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Conócenos</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold sm:text-5xl">
          <WordsReveal text="Un hotel que se siente como casa" />
        </h1>
        <Reveal delay={0.3} className="mt-4">
          <p className="leading-relaxed text-muted-foreground">
            {site.name} es un hotel familiar de {site.rooms} habitaciones en el
            centro de {site.locality}, en plena Huasteca Potosina. Aquí no te
            recibe un mostrador corporativo: te recibimos nosotros, en persona,
            como se recibe a alguien en casa.
          </p>
        </Reveal>
      </header>

      <div className="mt-12 grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <Reveal className="aspect-[16/11] overflow-hidden rounded-2xl">
          <div className="relative h-full w-full">
            <Photo
              src="/imagenes/corredor-arcos.jpg"
              alt="Corredor de arcos del Hotel Magic Collinn"
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
          </div>
        </Reveal>

        <Stagger className="grid gap-8">
          <StaggerItem>
            <h2 className="font-heading text-2xl font-semibold">
              Pequeño a propósito
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Tenemos {site.rooms} habitaciones —King Size, Doble Queen y una
              Suite—, todas climatizadas y cuidadas al detalle. Ser un hotel
              pequeño no es una limitación: es lo que nos permite hacer lo que
              un hotel grande no puede. Te mostramos la habitación antes de que
              te instales, te conocemos por tu nombre y estamos pendientes de lo
              que necesites durante tu estancia. No lo decimos nosotros: en las
              reseñas de Google se repite lo mismo una y otra vez — el trato
              cercano, la limpieza y la sensación de estar como en casa.
            </p>
          </StaggerItem>
          <StaggerItem>
            <h2 className="font-heading text-2xl font-semibold">
              A una calle de la plaza
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Estamos en {site.address.street}, {site.address.locality}, a una
              calle de la plaza principal. Llegas, dejas el coche en nuestro
              estacionamiento sin costo, y todo te queda caminando: los
              restaurantes, el mercado y la vida del pueblo.
            </p>
          </StaggerItem>
          <StaggerItem>
            <h2 className="font-heading text-2xl font-semibold">
              Tu base para la Huasteca
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Axtla está en el corazón de la Huasteca Potosina. Desde el hotel
              puedes salir en el día a cascadas, pozas y ríos cercanos, y
              regresar a dormir tranquilo al centro. Con gusto te recomendamos a
              dónde ir según la temporada; también puedes leer nuestras{" "}
              <Link
                href="/blog"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                guías en el blog
              </Link>
              .
            </p>
          </StaggerItem>
        </Stagger>
      </div>

      {/* Prueba social: reseñas reales de Google */}
      <section className="mt-20">
        <h2 className="font-heading text-3xl font-semibold">
          Lo que dicen quienes ya se quedaron
        </h2>
        <Stagger className="mt-8 grid gap-4 md:grid-cols-3">
          {testimonios.slice(0, 3).map((t) => (
            <StaggerItem key={t.nombre}>
              <figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
                <div
                  className="flex gap-0.5 text-primary"
                  aria-label={`${t.rating} de 5 estrellas`}
                >
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" aria-hidden />
                  ))}
                </div>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  “{t.texto}”
                </blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-medium">{t.nombre}</span>{" "}
                  <span className="text-muted-foreground">· {t.fecha}</span>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Cierre + CTA */}
      <Reveal className="mt-20 rounded-2xl border border-border bg-secondary/50 p-8 text-center sm:p-12">
        <h2 className="font-heading text-2xl font-semibold sm:text-3xl">
          Nos encantaría recibirte
        </h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted-foreground">
          Reserva directo con nosotros —sin comisiones y con reembolso del 100%
          si cancelas con 7 días o más— o escríbenos por WhatsApp si tienes
          cualquier duda.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button className="h-11 px-6" render={<Link href="/buscar" />}>
            Buscar disponibilidad
          </Button>
          <Button
            variant="secondary"
            className="h-11 gap-2 px-6"
            render={
              <a
                href={waLink(`Hola, quiero información sobre ${site.name}.`)}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <MessageCircle className="size-4" aria-hidden />
            Escríbenos por WhatsApp
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
