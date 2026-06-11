import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { site } from "@/lib/site";
import { heroImage } from "@/lib/images";

// Cuerpo: sans humanista cálida (distinta de Inter).
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Titulares: grotesca display con carácter (audaz, no es la default de IA).
const heading = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const description = `Hotel boutique de ${site.rooms} habitaciones en el centro de ${site.locality}, ${site.region}. Aire acondicionado, estacionamiento y reserva directa sin comisión.`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.legalName} · Hotel boutique en ${site.locality}, ${site.regionCode}`,
    template: `%s · ${site.name}`,
  },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: site.url,
    siteName: site.legalName,
    title: `${site.legalName} · Hotel boutique en ${site.locality}`,
    description,
    images: [{ url: heroImage, width: 1200, height: 630, alt: site.legalName }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.legalName} · Hotel boutique en ${site.locality}`,
    description,
    images: [heroImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${heading.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Navbar />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />

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
