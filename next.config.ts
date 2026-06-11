import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (Postgres embebido en WASM) no debe empaquetarse: se carga en runtime Node.
  serverExternalPackages: ["@electric-sql/pglite"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
