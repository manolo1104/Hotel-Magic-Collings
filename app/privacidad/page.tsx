import type { Metadata } from "next";
import { site } from "@/lib/site";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: `Aviso de privacidad del ${site.legalName}: qué datos personales recabamos al reservar, con qué finalidad y cómo ejercer tus derechos.`,
  alternates: { canonical: "/privacidad" },
};

// TODO: completar con la razón social y el domicilio legal del hotel.
export default function PrivacidadPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-28 pb-20 sm:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: "/" },
          { name: "Aviso de privacidad", url: "/privacidad" },
        ])}
      />
      <h1 className="font-heading text-4xl font-semibold sm:text-5xl">
        Aviso de privacidad
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Última actualización: junio de 2026
      </p>

      <div className="prose prose-neutral mt-8 max-w-none prose-headings:font-heading prose-headings:font-semibold prose-h2:text-2xl prose-a:text-primary prose-strong:text-foreground">
        <h2>Responsable del tratamiento</h2>
        <p>
          El <strong>{site.legalName}</strong>, con domicilio en{" "}
          {site.address.street}, {site.address.locality}, {site.address.region},
          México, es responsable del tratamiento de los datos personales que nos
          proporcionas a través de este sitio.
        </p>

        <h2>Datos que recabamos</h2>
        <p>
          Al reservar o escribirnos, recabamos únicamente los datos necesarios
          para atenderte:
        </p>
        <ul>
          <li>Nombre completo.</li>
          <li>Número de teléfono o WhatsApp.</li>
          <li>Correo electrónico (opcional).</li>
          <li>Fechas de estancia y número de huéspedes.</li>
        </ul>

        <h2>Para qué usamos tus datos</h2>
        <ul>
          <li>Gestionar y confirmar tu reserva.</li>
          <li>Comunicarnos contigo antes, durante y después de tu estancia.</li>
          <li>Responder tus dudas o solicitudes.</li>
        </ul>
        <p>
          No usamos tus datos para fines distintos a los anteriores ni los
          compartimos con terceros, salvo obligación legal.
        </p>

        <h2>Cómo ejercer tus derechos (ARCO)</h2>
        <p>
          Puedes solicitar el acceso, rectificación, cancelación u oposición al
          tratamiento de tus datos en cualquier momento escribiéndonos a{" "}
          <a href={`mailto:${site.email}`}>{site.email}</a> o por WhatsApp. Te
          responderemos a la brevedad.
        </p>

        <h2>Conservación y seguridad</h2>
        <p>
          Conservamos tus datos solo el tiempo necesario para gestionar tu
          reserva y cumplir obligaciones legales, y aplicamos medidas razonables
          para protegerlos.
        </p>

        <h2>Cambios a este aviso</h2>
        <p>
          Si modificamos este aviso, publicaremos la versión actualizada en esta
          misma página.
        </p>
      </div>
    </div>
  );
}
