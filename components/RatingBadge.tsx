import { Star } from "lucide-react";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Insignia de prueba social "★ 4.5 · 122 reseñas en Google".
 * Se coloca JUNTO a los CTAs de reserva (la confianza pegada al botón es el
 * factor #1 de conversión). Reutilizable en hero, tarjetas y CTA final.
 *
 * tone:
 *  - "onDark"  → sobre fondos de marca (hero/CTA drenched): texto crema.
 *  - "default" → sobre crema.
 */
export function RatingBadge({
  tone = "default",
  className,
}: {
  tone?: "default" | "onDark";
  className?: string;
}) {
  const onDark = tone === "onDark";
  return (
    <a
      href={site.googleReviewsUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${site.reviewsRating} de 5 estrellas, ${site.reviewsTotal} reseñas en Google. Ver en Google`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        onDark
          ? "border-white/25 bg-white/10 text-white hover:bg-white/15"
          : "border-border bg-card text-foreground hover:border-primary/40",
        className,
      )}
    >
      <Star
        className={cn(
          "size-4 shrink-0",
          onDark ? "fill-white text-white" : "fill-primary text-primary",
        )}
        aria-hidden
      />
      <span>
        <strong className="font-semibold">{site.reviewsRating}</strong>
        <span className={onDark ? "text-white/75" : "text-muted-foreground"}>
          {" "}
          · {site.reviewsTotal} reseñas en Google
        </span>
      </span>
    </a>
  );
}
