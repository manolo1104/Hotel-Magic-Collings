"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { EASE_OUT } from "./easing";

type Direction = "up" | "down" | "left" | "right" | "scale" | "none";

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: Direction;
  blur?: boolean;
  amount?: number;
  duration?: number;
}

const offset: Record<Direction, Record<string, number>> = {
  up: { y: 24 },
  down: { y: -24 },
  left: { x: 24 },
  right: { x: -24 },
  scale: { scale: 0.96 },
  none: {},
};

/** Aparición al entrar en viewport. Respeta reduced-motion (degrada a solo fade). */
export function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
  blur = false,
  amount = 0.2,
  duration = 0.6,
}: Props) {
  const reduce = useReducedMotion();

  const o = offset[direction];
  // Solo resetea las propiedades que el offset realmente usa (así "none" queda
  // como opacidad pura, sin transform identidad que rompa position: sticky).
  const reset = Object.fromEntries(
    Object.keys(o).map((k) => [k, k === "scale" ? 1 : 0]),
  );

  const hidden = reduce
    ? { opacity: 0 }
    : { opacity: 0, ...o, ...(blur ? { filter: "blur(6px)" } : {}) };

  const shown = reduce
    ? { opacity: 1 }
    : { opacity: 1, ...reset, ...(blur ? { filter: "blur(0px)" } : {}) };

  return (
    <motion.div
      className={className}
      initial={hidden}
      whileInView={shown}
      viewport={{ once: true, amount }}
      transition={{ duration, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
