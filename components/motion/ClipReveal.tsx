import type { ReactNode } from "react";

type From = "bottom" | "top" | "left" | "right";

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  from?: From;
}

// Antes animaba `clip-path` al hacer scroll, pero motion no completaba esa
// animación de forma fiable y dejaba las imágenes recortadas (invisibles).
// Ahora renderiza el contenido SIEMPRE visible: las fotos cargan con lazy-load
// y el placeholder borroso de next/image (componente Photo) dan el efecto de
// entrada sin riesgo de quedar en blanco. Se conservan las props por compat.
export function ClipReveal({ children, className }: Props) {
  return <div className={className}>{children}</div>;
}
