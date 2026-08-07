import Link from "next/link";
import Image from "next/image";
import {
  MessageCircle,
  Phone,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { site, waLink } from "@/lib/site";
import { getAllPosts } from "@/lib/content";
import { GarzaMark } from "@/components/brand/GarzaMark";

// Iconos de redes inline (lucide-react ya no incluye iconos de marcas)
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

// Redes con URL configurada en lib/site.ts (vacías = no se pintan)
const redes = [
  { label: "Facebook", href: site.socials.facebook, Icon: FacebookIcon },
  { label: "Instagram", href: site.socials.instagram, Icon: InstagramIcon },
].filter((r) => r.href);

export function Footer() {
  const year = new Date().getFullYear();
  const guias = getAllPosts().slice(0, 3);
  return (
    <footer className="mt-auto bg-brand text-brand-foreground">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:px-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="max-w-xs">
          {/* Lockup de marca del brand book: garza blanca + wordmark + etiqueta mono arena */}
          <div className="flex items-center gap-2.5">
            <GarzaMark className="size-8 text-brand-foreground" />
            <div>
              <div className="font-heading text-xl font-semibold">{site.name}</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-sand">
                Axtla · Huasteca Potosina
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-brand-foreground/70">
            {site.tagline}. {site.locality}, {site.region}. Reserva directa, sin
            intermediarios.
          </p>
          {redes.length > 0 && (
            <ul className="mt-4 flex items-center gap-3">
              {redes.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${site.name} en ${label}`}
                    className="inline-flex size-9 items-center justify-center rounded-full border border-brand-foreground/20 text-brand-foreground/80 transition-colors hover:border-brand-foreground/50 hover:text-brand-foreground"
                  >
                    <Icon className="size-4" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-brand-foreground/60">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-support" aria-hidden />
            <span>
              Pagos: {site.pagos.join(" · ")} · Pago en línea seguro con Mercado
              Pago
            </span>
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

        <nav className="text-sm">
          <h2 className="font-heading text-base font-semibold">
            Guías de viaje
          </h2>
          <ul className="mt-4 space-y-2.5">
            {guias.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/blog/${p.slug}`}
                  className="text-brand-foreground/75 transition-colors hover:text-brand-foreground"
                >
                  {p.title}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/blog"
                className="font-medium text-brand-foreground/90 transition-colors hover:text-brand-foreground"
              >
                Ver todo el blog →
              </Link>
            </li>
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/terminos"
              className="transition-colors hover:text-brand-foreground"
            >
              Términos y políticas
            </Link>
            <Link
              href="/privacidad"
              className="transition-colors hover:text-brand-foreground"
            >
              Aviso de privacidad
            </Link>
            <p>Con cariño en la Huasteca Potosina.</p>
            {/* Crédito de la plataforma que impulsa el sitio */}
            <a
              href="https://kora-hotel.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Hecho por Kora"
              className="inline-flex items-center gap-1.5 opacity-70 transition-opacity hover:opacity-100"
            >
              <span>Hecho por</span>
              <Image
                src="/kora-logo.png"
                alt="Kora"
                width={39}
                height={18}
                className="h-[18px] w-auto"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
