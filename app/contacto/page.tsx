import type { Metadata } from "next";
import { MessageCircle, Phone, MapPin, Navigation } from "lucide-react";
import { site, waLink } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/ContactForm";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd, hotelJsonLd } from "@/lib/seo";
import { Reveal } from "@/components/motion/Reveal";
import { WordsReveal } from "@/components/motion/WordsReveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

export const metadata: Metadata = {
  title: "Ubicación y contacto",
  description: `Cómo llegar al Hotel Magic Collinn en ${site.locality}, ${site.region}. WhatsApp, teléfono, correo y mapa.`,
  alternates: { canonical: "/contacto" },
};

const mapsDir = `https://www.google.com/maps/dir/?api=1&destination=${site.geo.lat},${site.geo.lng}`;
// Mapa interactivo embebido (sin API key). Si hay mapEmbedSrc propio, ese gana.
const mapEmbed =
  site.mapEmbedSrc ||
  `https://www.google.com/maps?q=${site.geo.lat},${site.geo.lng}&z=15&hl=es&output=embed`;

const cardCls =
  "flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-primary/50 hover-hover:-translate-y-0.5 hover-hover:shadow-md hover-hover:shadow-brand/5";

export default function ContactoPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-28 pb-20 sm:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: "/" },
          { name: "Contacto", url: "/contacto" },
        ])}
      />
      {/* Entidad Hotel (NAP + geo) — refuerza el SEO local en la página de contacto */}
      <JsonLd data={hotelJsonLd()} />

      <header className="max-w-2xl">
        <h1 className="font-heading text-4xl font-semibold sm:text-5xl">
          <WordsReveal text="Ubicación y contacto" />
        </h1>
        <Reveal delay={0.3} className="mt-4">
          <p className="leading-relaxed text-muted-foreground">
            Estamos en el centro de {site.locality}, {site.region}. Escríbenos por
            WhatsApp y te ayudamos con tu reserva o cualquier duda.
          </p>
        </Reveal>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        {/* Datos + formulario */}
        <div>
          <Stagger className="grid gap-3 sm:grid-cols-2">
            <StaggerItem>
              <a
                href={waLink(`Hola, quiero información sobre ${site.name}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className={cardCls}
              >
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-support/15 text-support">
                  <MessageCircle className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium">WhatsApp</span>
                  <span className="block text-xs text-muted-foreground">
                    Respuesta rápida
                  </span>
                </span>
              </a>
            </StaggerItem>
            <StaggerItem>
              <a href={`tel:${site.phone.replace(/\s+/g, "")}`} className={cardCls}>
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-muted text-brand">
                  <Phone className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium">Teléfono</span>
                  <span className="block text-xs text-muted-foreground">
                    {site.phone}
                  </span>
                </span>
              </a>
            </StaggerItem>
            <StaggerItem>
              <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-brand">
                  <MapPin className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium">Dirección</span>
                  <span className="block text-xs text-muted-foreground">
                    {site.address.street}, {site.address.locality},{" "}
                    {site.address.region} {site.address.postalCode}
                  </span>
                </span>
              </div>
            </StaggerItem>
          </Stagger>

          <Reveal className="mt-8">
            <h2 className="font-heading text-xl font-semibold">
              Envíanos un mensaje
            </h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              Te respondemos lo antes posible.
            </p>
            <ContactForm />
          </Reveal>
        </div>

        {/* Mapa + cómo llegar */}
        <Reveal direction="left" className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-muted">
            <iframe
              src={mapEmbed}
              title={`Mapa del ${site.legalName} en ${site.locality}`}
              className="h-[360px] w-full lg:h-[480px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Centro de {site.locality}, {site.region}
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                render={
                  <a href={mapsDir} target="_blank" rel="noopener noreferrer" />
                }
              >
                <Navigation className="size-4" aria-hidden />
                Cómo llegar
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Cómo llegar</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Magic Collinn se encuentra en pleno centro de {site.locality}, a
              pocos minutos de la carretera y a pasos de la plaza principal. Si
              vienes desde la carretera México 85, toma la salida hacia el centro
              y síguenos por WhatsApp para indicaciones exactas.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
