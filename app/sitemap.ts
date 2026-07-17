import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getAllPosts } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/habitaciones`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/galeria`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contacto`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/nosotros`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/privacidad`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terminos`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
  const posts: MetadataRoute.Sitemap = getAllPosts().map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: new Date(`${p.date}T12:00:00`),
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...staticRoutes, ...posts];
}
