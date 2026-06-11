"use client";

import { Fragment } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { EASE_OUT } from "./easing";

interface Props {
  text: string;
  className?: string;
  delay?: number;
  trigger?: "mount" | "inView";
}

const container: Variants = {
  hidden: {},
  show: (delay: number) => ({
    transition: { staggerChildren: 0.05, delayChildren: delay },
  }),
};

const word: Variants = {
  hidden: { opacity: 0, y: "0.5em", filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: EASE_OUT },
  },
};

/** Revela un titular palabra por palabra. Colócalo dentro del <h1>/<h2>. */
export function WordsReveal({ text, className, delay = 0, trigger = "mount" }: Props) {
  const reduce = useReducedMotion();
  const words = text.split(" ");

  if (reduce) return <span className={className}>{text}</span>;

  const triggerProps =
    trigger === "mount"
      ? { animate: "show" as const }
      : { whileInView: "show" as const, viewport: { once: true, amount: 0.4 } };

  return (
    <motion.span
      className={className}
      variants={container}
      custom={delay}
      initial="hidden"
      {...triggerProps}
    >
      {words.map((w, i) => (
        <Fragment key={i}>
          <motion.span variants={word} className="inline-block pb-[0.08em]">
            {w}
          </motion.span>
          {i < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </motion.span>
  );
}
