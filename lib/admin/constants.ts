// Constantes del panel SIN dependencias de Node — seguras para importar
// desde proxy.ts (Edge runtime), donde node:crypto / next/headers no existen.
export const ADMIN_COOKIE = "mc_admin";
export const ADMIN_MAX_AGE = 60 * 60 * 24 * 7; // 7 días (segundos)
