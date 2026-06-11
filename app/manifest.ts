import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.legalName,
    short_name: site.name,
    description: `Hotel boutique de ${site.rooms} habitaciones en el centro de ${site.locality}, ${site.region}.`,
    start_url: "/",
    display: "standalone",
    lang: "es-MX",
    background_color: "#faf8f3",
    theme_color: "#143a2a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
