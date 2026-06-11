import Image, { type ImageProps } from "next/image";

// Placeholder cálido (tono arena) mientras carga la imagen: evita el "blanco".
// SVG data-url URL-encoded (sin Buffer) para servidor o cliente.
const BLUR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><rect width="16" height="12" fill="#ece6d9"/></svg>',
)}`;

/**
 * next/image con blur placeholder y lazy-load por defecto.
 * Lazy en todas las imágenes salvo las marcadas con `priority` (el hero/LCP).
 */
export function Photo({ priority = false, loading, ...props }: ImageProps) {
  return (
    <Image
      placeholder="blur"
      blurDataURL={BLUR}
      priority={priority}
      loading={loading ?? (priority ? undefined : "lazy")}
      {...props}
    />
  );
}
