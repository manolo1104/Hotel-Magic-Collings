"use client";

import { motion } from "motion/react";
import { EASE_OUT } from "@/components/motion/easing";

// Transición sutil entre rutas. Solo opacidad (sin transform) para no crear un
// bloque contenedor que rompa los `position: sticky` de las páginas.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
