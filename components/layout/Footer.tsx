import Link from "next/link";
import { Leaf, MessageCircle, Phone, Mail, MapPin } from "lucide-react";
import { site, waLink } from "@/lib/site";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto bg-brand text-brand-foreground">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div className="max-w-xs">
          <div className="flex items-center gap-2 font-heading text-xl font-semibold">
            <Leaf className="size-5 text-support" strokeWidth={1.75} aria-hidden />
            {site.name}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-brand-foreground/70">
            {site.tagline}. {site.locality}, {site.region}. Reserva directa, sin
            intermediarios.
          </p>
        </div>

        <nav className="text-sm">
          <h2 className="font-heading text-base font-semibold">Explora</h2>
          <ul className="mt-4 space-y-2.5">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-brand-foreground/75 transition-colors hover:text-brand-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="text-sm">
          <h2 className="font-heading text-base font-semibold">Contacto</h2>
          <ul className="mt-4 space-y-3 text-brand-foreground/80">
            <li>
              <a
                href={waLink(
                  `Hola, quiero información sobre ${site.name}.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-brand-foreground"
              >
                <MessageCircle className="size-4 text-support" aria-hidden />
                WhatsApp
              </a>
            </li>
            <li>
              <a
                href={`tel:${site.phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-2 hover:text-brand-foreground"
              >
                <Phone className="size-4 text-support" aria-hidden />
                {site.phone}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${site.email}`}
                className="inline-flex items-center gap-2 hover:text-brand-foreground"
              >
                <Mail className="size-4 text-support" aria-hidden />
                {site.email}
              </a>
            </li>
            <li className="inline-flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-support" aria-hidden />
              <span>
                {site.address.street}, {site.address.locality},{" "}
                {site.address.region}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-brand-foreground/15">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-5 text-xs text-brand-foreground/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {year} {site.legalName}. Todos los derechos reservados.
          </p>
          <p>Hecho con cariño en la Huasteca Potosina.</p>
        </div>
      </div>
    </footer>
  );
}
