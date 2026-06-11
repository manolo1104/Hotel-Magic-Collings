"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { EASE_OUT } from "./easing";

interface Props {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}

/** Cuenta de 0 al valor al entrar en viewport. Formatea con separador es-MX. */
export function CountUp({ value, prefix = "", suffix = "", className, duration = 1 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setN(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setN(v),
    });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {Math.round(n).toLocaleString("es-MX")}
      {suffix}
    </span>
  );
}
