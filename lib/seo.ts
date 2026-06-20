// ============================================================
// Helpers de Schema.org (JSON-LD) — grafo conectado por @id
// Google y los LLMs entienden mejor un @graph con entidades enlazadas.
// ============================================================
import { site, amenities, faqs, testimonios } from "./site";
import { heroImage, galeria } from "./images";

const HOTEL_ID = `${site.url}/#hotel`;
const WEBSITE_ID = `${site.url}/#website`;
const OG_IMAGE = `${site.url}/opengraph-image`;
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${site.geo.lat},${site.geo.lng}`;

const postalAddress = {
  "@type": "PostalAddress",
  streetAddress: site.address.street,
  addressLocality: site.address.locality,
  addressRegion: site.address.region,
  postalCode: site.address.postalCode,
  addressCountry: site.address.country,
};

const hotelDescription = `Hotel boutique de ${site.rooms} habitaciones en el centro de ${site.locality}, ${site.region}. Aire acondicionado, estacionamiento y reserva directa sin comisión.`;

/** Entidad Hotel (LocalBusiness) — fuente de verdad del grafo. */
export function hotelEntity(): Record<string, unknown> {
  return {
    "@type": "Hotel",
    "@id": HOTEL_ID,
    name: site.legalName,
    description: hotelDescription,
    url: site.url,
    telephone: site.phone,
    email: site.email,
    priceRange: site.priceRange,
    currenciesAccepted: "MXN",
    paymentAccepted: "Efectivo, Tarjeta de crédito, Transferencia, Pago en OXXO",
    availableLanguage: "Spanish",
    address: postalAddress,
    geo: {
      "@type": "GeoCoordinates",
      latitude: site.geo.lat,
      longitude: site.geo.lng,
    },
    hasMap: mapsUrl,
    numberOfRooms: site.rooms,
    checkinTime: site.checkIn,
    checkoutTime: site.checkOut,
    ...(site.petsAllowed === null ? {} : { petsAllowed: site.petsAllowed }),
    image: [heroImage, ...galeria.slice(0, 3)],
    logo: OG_IMAGE,
    amenityFeature: amenities.map((a) => ({
      "@type": "LocationFeatureSpecification",
      name: a.title,
      value: true,
    })),
    areaServed: {
      "@type": "Place",
      name: `${site.locality}, ${site.region}, Huasteca Potosina`,
    },
    sameAs: [site.googleReviewsUrl],
    // Calificación agregada (reseñas reales de Google), respaldada por las
    // reseñas visibles en la página de Inicio.
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: site.reviewsRating,
      reviewCount: site.reviewsTotal,
      bestRating: "5",
      worstRating: "1",
    },
    review: testimonios.slice(0, 3).map((t) => ({
      "@type": "Review",
      author: { "@type": "Person", name: t.nombre },
      reviewRating: {
        "@type": "Rating",
        ratingValue: String(t.rating),
        bestRating: "5",
      },
      reviewBody: t.texto,
    })),
  };
}

/** Entidad WebSite. */
export function websiteEntity(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: site.url,
    name: site.legalName,
    inLanguage: "es-MX",
    publisher: { "@id": HOTEL_ID },
  };
}

/** Nodo FAQPage a partir de las preguntas frecuentes. */
export function faqPageNode(): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    "@id": `${site.url}/#faq`,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Grafo de la página de Inicio: Hotel + WebSite + FAQPage. */
export function homeGraphJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [hotelEntity(), websiteEntity(), faqPageNode()],
  };
}

export interface RoomSeoInput {
  slug: string;
  nombre: string;
  descripcion: string;
  capacidad: number;
  tarifaBase: number;
  amenidades: string[];
  fotos: string[];
}

/** Habitaciones como HotelRoom + Offer (precio/moneda) para /habitaciones. */
export function roomsJsonLd(rooms: RoomSeoInput[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": rooms.map((r) => ({
      "@type": "HotelRoom",
      "@id": `${site.url}/habitaciones#${r.slug}`,
      name: r.nombre,
      description: r.descripcion,
      url: `${site.url}/habitaciones`,
      ...(r.fotos[0] ? { image: [r.fotos[0]] } : {}),
      occupancy: {
        "@type": "QuantitativeValue",
        maxValue: r.capacidad,
        unitText: "persona",
      },
      amenityFeature: r.amenidades.map((a) => ({
        "@type": "LocationFeatureSpecification",
        name: a,
        value: true,
      })),
      containedInPlace: { "@id": HOTEL_ID },
      offers: {
        "@type": "Offer",
        price: r.tarifaBase,
        priceCurrency: "MXN",
        availability: "https://schema.org/InStock",
        url: `${site.url}/buscar?tipo=${r.slug}`,
      },
    })),
  };
}

/** Article — para cada post del blog. */
export function articleJsonLd(post: {
  title: string;
  description: string;
  date: string;
  updated?: string;
  cover?: string;
  slug: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    inLanguage: "es-MX",
    image: post.cover ? [post.cover] : undefined,
    mainEntityOfPage: `${site.url}/blog/${post.slug}`,
    isPartOf: { "@id": WEBSITE_ID },
    // Autor = el hotel, una fuente local real en Axtla (señal E-E-A-T)
    author: {
      "@type": "Organization",
      "@id": HOTEL_ID,
      name: site.legalName,
      url: site.url,
    },
    publisher: {
      "@type": "Organization",
      name: site.legalName,
      logo: { "@type": "ImageObject", url: OG_IMAGE },
    },
  };
}

/** Listado del blog: CollectionPage + ItemList. */
export function blogListJsonLd(
  posts: { title: string; slug: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${site.url}/blog`,
    name: `Blog del ${site.legalName}`,
    inLanguage: "es-MX",
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.title,
        url: `${site.url}/blog/${p.slug}`,
      })),
    },
  };
}

/** BreadcrumbList — para rutas internas. */
export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${site.url}${it.url}`,
    })),
  };
}
