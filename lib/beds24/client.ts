// ============================================================
// CLIENTE DE BEDS24 (API v2) — el channel manager que conecta con Booking.com
//
// Beds24 es quien habla con Booking.com. Nosotros solo hablamos con Beds24:
//   · sitio → Beds24 → Booking   (creamos/cancelamos reservas allá)
//   · Booking → Beds24 → sitio   (webhook + repesca periódica)
//
// AUTENTICACIÓN (tres pasos, documentados en la especificación oficial):
//   1. En beds24.com/control3.php?pagetype=apiv2 se genera un CÓDIGO de
//      invitación con los permisos (scopes) bookings, inventory, properties.
//   2. Ese código se canjea UNA sola vez por un refreshToken (que no caduca
//      mientras se use al menos cada 30 días) → `canjearCodigoDeInvitacion`.
//   3. El refreshToken se cambia por un token de acceso de corta vida, que es
//      el que va en el header `token` de cada llamada. Aquí se cachea.
//
// APAGADO POR DEFECTO: sin BEDS24_REFRESH_TOKEN el sitio funciona exactamente
// como hoy (misma degradación grácil que Mercado Pago en lib/mp.ts).
// ============================================================

const BASE = (process.env.BEDS24_API_URL || "https://api.beds24.com/v2").replace(
  /\/+$/,
  "",
);
const TIMEOUT_MS = 20_000;
// Margen de seguridad para no usar un token que caduca en el camino.
const MARGEN_MS = 60_000;

// En globalThis para sobrevivir al hot-reload de desarrollo (si no, cada
// recarga pediría un token nuevo y quemaría el límite de peticiones).
const global_ = globalThis as unknown as {
  __mcBeds24Token?: { valor: string; expiraEn: number };
};

/** ¿Está configurado el channel manager? Sin esto, todo lo demás no hace nada. */
export function beds24Activo(): boolean {
  return Boolean(process.env.BEDS24_REFRESH_TOKEN?.trim());
}

export class Beds24Error extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly cuerpo?: string,
  ) {
    super(message);
    this.name = "Beds24Error";
  }
}

/**
 * Avisa cuando queda poco crédito de peticiones. Beds24 cobra "créditos" por
 * llamada en ventanas de 5 minutos; agotarlos deja al sitio sin sincronizar.
 */
function vigilarLimite(res: Response, ruta: string): void {
  const cabecera = res.headers.get("X-FiveMinCreditLimit-Remaining");
  if (cabecera == null) return; // la respuesta no trae el dato: nada que vigilar
  const restante = Number(cabecera);
  if (Number.isFinite(restante) && restante < 50) {
    console.warn(
      `[beds24] quedan ${restante} créditos de 5 min (tras ${ruta}). Bajando el ritmo.`,
    );
  }
}

/** Token de acceso vigente (lo renueva con el refreshToken cuando hace falta). */
async function tokenDeAcceso(): Promise<string> {
  const cache = global_.__mcBeds24Token;
  if (cache && cache.expiraEn > Date.now()) return cache.valor;

  const refresh = process.env.BEDS24_REFRESH_TOKEN?.trim();
  if (!refresh) throw new Beds24Error("Falta BEDS24_REFRESH_TOKEN", 0);

  const res = await fetch(`${BASE}/authentication/token`, {
    headers: { refreshToken: refresh, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  vigilarLimite(res, "authentication/token");
  const texto = await res.text();
  if (!res.ok) {
    // El refreshToken caduca si no se usa en 30 días: hay que regenerarlo.
    throw new Beds24Error(
      `No se pudo renovar el token de Beds24 (HTTP ${res.status}). Si el refreshToken lleva más de 30 días sin usarse, genera uno nuevo.`,
      res.status,
      texto.slice(0, 500),
    );
  }
  const data = JSON.parse(texto) as { token?: string; expiresIn?: number };
  if (!data.token) throw new Beds24Error("Beds24 no devolvió token", 502, texto.slice(0, 500));

  const duracion = (Number(data.expiresIn) || 3600) * 1000;
  global_.__mcBeds24Token = {
    valor: data.token,
    expiraEn: Date.now() + Math.max(0, duracion - MARGEN_MS),
  };
  return data.token;
}

interface Opciones {
  metodo?: "GET" | "POST" | "DELETE";
  /** Parámetros de query. Un arreglo se repite (roomId=1&roomId=2). */
  query?: Record<string, string | number | boolean | (string | number)[] | undefined>;
  cuerpo?: unknown;
}

function construirUrl(ruta: string, query?: Opciones["query"]): string {
  const url = new URL(`${BASE}${ruta.startsWith("/") ? ruta : `/${ruta}`}`);
  for (const [clave, valor] of Object.entries(query ?? {})) {
    if (valor === undefined) continue;
    if (Array.isArray(valor)) for (const v of valor) url.searchParams.append(clave, String(v));
    else url.searchParams.set(clave, String(valor));
  }
  return url.toString();
}

/** Llamada autenticada a la API v2. Lanza Beds24Error si la respuesta no es OK. */
export async function beds24<T = unknown>(ruta: string, opts: Opciones = {}): Promise<T> {
  const token = await tokenDeAcceso();
  const res = await fetch(construirUrl(ruta, opts.query), {
    method: opts.metodo ?? "GET",
    headers: {
      token,
      accept: "application/json",
      ...(opts.cuerpo !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: opts.cuerpo !== undefined ? JSON.stringify(opts.cuerpo) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  vigilarLimite(res, ruta);
  const texto = await res.text();

  if (res.status === 401) {
    // Token rechazado: tíralo para que la próxima llamada pida uno nuevo.
    global_.__mcBeds24Token = undefined;
  }
  if (!res.ok) {
    throw new Beds24Error(`Beds24 ${ruta} respondió ${res.status}`, res.status, texto.slice(0, 500));
  }
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new Beds24Error(`Beds24 ${ruta} devolvió una respuesta no-JSON`, 502, texto.slice(0, 500));
  }
}

// ── Formas de respuesta que usamos ──────────────────────────
export interface Beds24Room {
  id: number;
  propertyId: number;
  name: string;
  qty: number;
  maxPeople?: number;
}

export interface Beds24Property {
  id: number;
  name: string;
  roomTypes?: Beds24Room[];
}

export interface Beds24Booking {
  id: number;
  propertyId: number;
  roomId: number;
  status: string; // confirmed | request | new | cancelled | black | inquiry
  arrival: string; // YYYY-MM-DD
  departure: string;
  numAdult?: number;
  numChild?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  price?: number;
  channel?: string;
  apiReference?: string;
  referer?: string;
  notes?: string;
  comments?: string;
  modifiedTime?: string;
  cancelTime?: string | null;
}

interface RespuestaLista<T> {
  success?: boolean;
  data?: T[];
  pages?: { nextPageExists?: boolean };
}

/** Habitaciones (tipos) de la cuenta, con su id de Beds24 y cuántas unidades tiene. */
export async function listarHabitaciones(): Promise<Beds24Room[]> {
  const res = await beds24<RespuestaLista<Beds24Room>>("/properties/rooms", {
    query: { includeUnitDetails: false },
  });
  return res.data ?? [];
}

/** Reservas modificadas desde una fecha (ISO en UTC). Pagina hasta agotar. */
export async function listarReservas(params: {
  modifiedFrom?: string;
  arrivalFrom?: string;
  status?: string[];
}): Promise<Beds24Booking[]> {
  const salida: Beds24Booking[] = [];
  // Tope de páginas: una cuenta sana nunca se acerca; evita un bucle infinito
  // si Beds24 devolviera siempre nextPageExists.
  for (let page = 1; page <= 20; page++) {
    const res = await beds24<RespuestaLista<Beds24Booking>>("/bookings", {
      query: {
        page,
        modifiedFrom: params.modifiedFrom,
        arrivalFrom: params.arrivalFrom,
        status: params.status,
      },
    });
    salida.push(...(res.data ?? []));
    if (!res.pages?.nextPageExists) break;
  }
  return salida;
}

/** Reserva NUEVA: Beds24 exige al menos habitación y fechas. */
export interface AltaReserva {
  roomId: number;
  status: string;
  arrival: string;
  departure: string;
  numAdult?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  price?: number;
  apiReference?: string;
  notes?: string;
  referer?: string;
}

/** Cambio sobre una reserva EXISTENTE: el id manda, lo demás es opcional. */
export interface CambioReserva {
  id: number;
  status?: string;
  arrival?: string;
  departure?: string;
  price?: number;
  notes?: string;
}

interface RespuestaPost {
  success?: boolean;
  new?: { id?: number };
  modified?: { id?: number };
  errors?: { field?: string; message?: string }[];
  type?: string;
}

/**
 * Crea o modifica reservas. Beds24 responde un arreglo con un resultado por
 * cada entrada enviada; devolvemos el id resultante de cada una.
 */
export async function guardarReservas(
  reservas: (AltaReserva | CambioReserva)[],
): Promise<number[]> {
  if (reservas.length === 0) return [];
  const res = await beds24<RespuestaPost[]>("/bookings", {
    metodo: "POST",
    cuerpo: reservas,
  });
  return res.map((r, i) => {
    if (r.success === false) {
      const detalle = (r.errors ?? []).map((e) => `${e.field ?? ""} ${e.message ?? ""}`.trim());
      throw new Beds24Error(
        `Beds24 rechazó la reserva ${i + 1}: ${detalle.join("; ") || "sin detalle"}`,
        422,
      );
    }
    const id = r.new?.id ?? r.modified?.id;
    if (!id) throw new Beds24Error(`Beds24 no devolvió el id de la reserva ${i + 1}`, 502);
    return id;
  });
}

/** Canjea el código de invitación por un refreshToken permanente (paso único). */
export async function canjearCodigoDeInvitacion(
  codigo: string,
  nombreDispositivo = "Magic Collinn",
): Promise<{ refreshToken: string; token: string }> {
  const res = await fetch(`${BASE}/authentication/setup`, {
    headers: { code: codigo, deviceName: nombreDispositivo, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const texto = await res.text();
  if (!res.ok)
    throw new Beds24Error(
      `El código de invitación no fue aceptado (HTTP ${res.status}). Genéralo de nuevo: los códigos caducan a los pocos minutos.`,
      res.status,
      texto.slice(0, 500),
    );
  const data = JSON.parse(texto) as { token?: string; refreshToken?: string };
  if (!data.refreshToken) throw new Beds24Error("Beds24 no devolvió refreshToken", 502);
  return { refreshToken: data.refreshToken, token: data.token ?? "" };
}
