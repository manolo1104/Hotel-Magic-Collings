import { cn } from "@/lib/utils";

// Isotipo de marca: la garza blanca de Axtla (concepto A del brand book).
// Hereda el color vía currentColor para usarse con text-brand / text-sand / etc.
export function GarzaMark({
  className,
  strokeWidth = 6,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 120 150"
      className={cn("shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        d="M58 80 C 30 78 26 55 54 53 C 78 51 92 60 108 68 C 90 80 74 82 58 80 Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M60 54 C 54 40 68 38 62 24" />
      <circle cx="61" cy="20" r="6" fill="currentColor" stroke="none" />
      <path d="M57 18 L40 22" />
      <path d="M52 80 L44 128 M60 80 L64 128" />
      <path d="M44 128 l-9 4 M64 128 l9 4" />
    </svg>
  );
}
