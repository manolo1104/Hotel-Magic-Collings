"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { EASE_OUT } from "./easing";

type From = "bottom" | "top" | "left" | "right";

// Unidades consistentes (todo en %) para que motion pueda interpolar el clip-path.
// Mezclar "100%" con "0" sin unidad rompe la animación y deja el tile oculto.
const hiddenInset: Record<From, string> = {
  bottom: "inset(0% 0% 100% 0%)",
  top: "inset(100% 0% 0% 0%)",
  left: "inset(0% 100% 0% 0%)",
  right: "inset(0% 0% 0% 100%)",
};

const shownInset = "inset(0% 0% 0% 0%)";

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  from?: From;
}

/** Revela su contenido (una imagen) animando clip-path al entrar en viewport. */
export function ClipReveal({ children, className, delay = 0, from = "bottom" }: Props) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ clipPath: hiddenInset[from], opacity: 0.5 }}
      whileInView={{ clipPath: shownInset, opacity: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
