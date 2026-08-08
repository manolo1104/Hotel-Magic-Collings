import type { Metadata } from "next";
import { site, waLink, tramosCancelacion } from "@/lib/site";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Términos y políticas de reserva",
  description: `Políticas de reserva del ${site.legalName}: pago y anticipo, cancelaciones y cambios, horarios de llegada y salida, y formas de pago aceptadas.`,
  alternates: { canonical: "/terminos" },
};

export default function TerminosPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-28 pb-20 sm:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: "/" },
          { name: "Términos y políticas", url: "/terminos" },
        ])}
      />
      <h1 className="font-heading text-4xl font-semibold sm:text-5xl">
        Términos y políticas de reserva
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Última actualización: julio de 2026
      </p>

      <div className="prose prose-neutral mt-8 max-w-none prose-headings:font-heading prose-headings:font-semibold prose-h2:text-2xl prose-a:text-primary prose-strong:text-foreground">
        <h2>Cómo reservar</h2>
        <p>
          Reservas directo en este sitio: eliges tus fechas, la habitación y el
          número de huéspedes, y completas tus datos. Al terminar te enviamos la
          confirmación por WhatsApp en menos de 24 horas.
        </p>

        <h2>Pago y anticipo</h2>
        <p>
          Cuánto pagas al reservar depende de cuántas noches te quedas:
        </p>
        <ul>
          <li>
            <strong>Una noche:</strong> se paga el <strong>100%</strong> al
            reservar.
          </li>
          <li>
            <strong>Dos noches o más:</strong> eliges tú. Puedes pagar el{" "}
            <strong>100%</strong>, o apartar con un{" "}
            <strong>anticipo del 50%</strong> y liquidar el resto al llegar al
            hotel.
          </li>
        </ul>
        <p>
          El pago en línea se procesa de forma segura con{" "}
          <strong>Mercado Pago</strong> (nosotros nunca vemos tus datos de
          tarjeta). En el hotel aceptamos {site.pagos.join(", ").toLowerCase()}.
        </p>

        <h2>Cancelaciones y cambios</h2>
        <p>
          Los días se cuentan desde que nos avisas hasta tu fecha de llegada:
        </p>
        <ul>
          {tramosCancelacion.map((t) => (
            <li key={t.plazo}>
              <strong>{t.plazo}:</strong> {t.resultado}. {t.detalle}
            </li>
          ))}
        </ul>
        <p>
          Para cancelar o cambiar fechas, avísanos por{" "}
          <a href={waLink()} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>{" "}
          o al correo <a href={`mailto:${site.email}`}>{site.email}</a>. Si algo
          se complica con tu viaje, escríbenos: siempre buscamos la manera de
          ayudarte.
        </p>

        <h2>Llegada y salida</h2>
        <p>
          El check-in es a partir de las {site.checkIn} h y el check-out hasta
          las {site.checkOut} h. Si llegas antes o necesitas salir un poco más
          tarde, dinos con anticipación y vemos qué se puede hacer según la
          ocupación del día.
        </p>

        <h2>Mascotas</h2>
        <p>Por el momento no recibimos mascotas en el hotel.</p>

        <h2>Mejor precio garantizado</h2>
        <p>
          Al reservar directo con nosotros obtienes la mejor tarifa, sin
          comisiones de intermediarios.
        </p>

        <h2>Dudas</h2>
        <p>
          Cualquier pregunta sobre estas políticas, escríbenos por{" "}
          <a href={waLink()} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>{" "}
          o a <a href={`mailto:${site.email}`}>{site.email}</a>. Somos un hotel
          pequeño: te responde una persona, no un sistema.
        </p>
      </div>
    </div>
  );
}
