import type { Metadata, Viewport } from "next";
import { Newsreader, Hanken_Grotesk, Space_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { PublicShell } from "@/components/layout/PublicShell";
import { site } from "@/lib/site";

// Cuerpo/UI: sans humanista cálida (distinta de Inter).
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Titulares: Newsreader, la serif del brand book "Garza & Río" — literaria,
// de contraste suave, cálida y editorial sin caer en lo corporativo.
const heading = Newsreader({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  // Solo los pesos que usan los titulares (instancias estáticas, mucho más
  // ligeras que la variable completa) → la fuente crítica llega antes en móvil
  // lento y el titular (LCP) pinta su forma final cuanto antes.
  weight: ["400", "500", "600", "700"],
});

// Etiquetas y datos (kickers, lockup de marca): Space Mono, el accent del brand book.
const mono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "700"],
});

const description = `Hotel de ${site.rooms} habitaciones en el centro de ${site.locality}, ${site.region}: limpio, tranquilo y a precio justo. Aire acondicionado, estacionamiento y reserva directa sin comisión.`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.legalName} · Hotel en el centro de ${site.locality}, ${site.regionCode}`,
    template: `%s · ${site.name}`,
  },
  description,
  alternates: { canonical: "/" },
  // Verificación de Google Search Console (se omite si la env está vacía).
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: site.url,
    siteName: site.legalName,
    title: `${site.legalName} · Hotel en el centro de ${site.locality}`,
    description,
    // La imagen OG la genera app/opengraph-image.tsx (marca, 1200×630).
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.legalName} · Hotel en el centro de ${site.locality}`,
    description,
    // twitter:image también lo provee app/opengraph-image.tsx.
  },
};

export const viewport: Viewport = {
  // Color de marca en la UI del navegador (barra en móvil) — verde ribera
  themeColor: "#234A31",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${heading.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {/* Skip link (WCAG 2.4.1): visible solo al enfocar con teclado */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:border focus:border-border focus:bg-card focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg"
        >
          Saltar al contenido
        </a>
        <PublicShell footer={<Footer />}>{children}</PublicShell>

        {site.gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${site.gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${site.gaId}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
