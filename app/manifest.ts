import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.legalName,
    short_name: site.name,
    description: `Hotel de ${site.rooms} habitaciones en el centro de ${site.locality}, ${site.region}: limpio, tranquilo y a precio justo.`,
    start_url: "/",
    display: "standalone",
    lang: "es-MX",
    background_color: "#FCF8F0",
    theme_color: "#234A31",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
