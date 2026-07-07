import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formatea un entero MXN: 1200 → "$1,200 MXN" (separador es-MX). */
export function formatMXN(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")} MXN`
}
