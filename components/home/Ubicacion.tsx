import { MapPin, Navigation, MessageCircle } from "lucide-react";
import { site, waLink } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";

// Ubicación en el mapa, tras la comparativa "reservar directo": refuerza la
// confianza (ver dónde vas a dormir, en pleno centro) antes de las reseñas.
const mapsDir = `https://www.google.com/maps/dir/?api=1&destination=${site.geo.lat},${site.geo.lng}`;
const mapEmbed =
  site.mapEmbedSrc ||
  `https://www.google.com/maps?q=${site.geo.lat},${site.geo.lng}&z=15&hl=es&output=embed`;

export function Ubicacion() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 md:py-28">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <Reveal>
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <MapPin className="size-4" strokeWidth={1.75} aria-hidden />
            Dónde estamos
          </p>
          <h2 className="mt-4 max-w-xl font-heading text-3xl font-semibold leading-[1.08] sm:text-4xl lg:text-5xl">
            En pleno centro, a una calle de la plaza
          </h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Estamos en {site.address.street}, {site.address.locality},{" "}
            {site.address.region}. Llegas, dejas el coche en nuestro
            estacionamiento sin costo, y todo te queda caminando: restaurantes,
            mercado y la vida del pueblo.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              className="h-11 gap-2 px-6"
              render={
                <a href={mapsDir} target="_blank" rel="noopener noreferrer" />
              }
            >
              <Navigation className="size-4" aria-hidden />
              Cómo llegar
            </Button>
            <Button
              variant="secondary"
              className="h-11 gap-2 px-6"
              render={
                <a
                  href={waLink(
                    `Hola, quiero llegar a ${site.name}. ¿Me pueden dar indicaciones?`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <MessageCircle className="size-4" aria-hidden />
              Pedir indicaciones
            </Button>
          </div>
        </Reveal>

        <Reveal direction="left">
          <div className="overflow-hidden rounded-2xl border border-border bg-muted">
            <iframe
              src={mapEmbed}
              title={`Mapa del ${site.legalName} en ${site.locality}`}
              className="h-[320px] w-full lg:h-[420px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Centro de {site.locality}, {site.region}
              </span>
              <span className="text-sm font-medium text-brand">
                Check-in {site.checkIn} h
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
