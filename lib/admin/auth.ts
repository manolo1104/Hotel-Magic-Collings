// ============================================================
// AUTENTICACIÓN DEL PANEL /admin — cookie de sesión firmada (HMAC).
// El proxy.ts hace el chequeo optimista (existe cookie); la verificación
// REAL de la firma ocurre aquí, server-side (Node), en páginas y handlers.
// ============================================================
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, ADMIN_MAX_AGE } from "./constants";

export { ADMIN_COOKIE, ADMIN_MAX_AGE };

const SECRET = process.env.ADMIN_SESSION_SECRET || "";
const PASSWORD = process.env.ADMIN_PASSWORD || "";

/** ¿El panel tiene contraseña y secreto configurados? */
export function adminConfigurado(): boolean {
  return PASSWORD.length > 0 && SECRET.length > 0;
}

/** Compara la contraseña en tiempo constante. */
export function passwordCorrecta(input: string): boolean {
  if (!PASSWORD) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(PASSWORD);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function firmar(exp: number): string {
  return createHmac("sha256", SECRET).update(`admin.${exp}`).digest("hex");
}

/** Token de sesión = `${expira}.${hmac}`. */
export function crearToken(): string {
  const exp = Date.now() + ADMIN_MAX_AGE * 1000;
  return `${exp}.${firmar(exp)}`;
}

/** Valida firma + vigencia del token. */
export function tokenValido(token: string | undefined): boolean {
  if (!token || !SECRET) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || Number.isNaN(exp) || exp < Date.now() || !sig) return false;
  const esperado = firmar(exp);
  if (sig.length !== esperado.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
  } catch {
    return false;
  }
}

/** Lee la cookie de sesión y verifica la firma (server-side). */
export async function sesionActiva(): Promise<boolean> {
  const c = await cookies();
  return tokenValido(c.get(ADMIN_COOKIE)?.value);
}
