"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  agruparCamas,
  camasCorto,
  desagruparCamas,
  TIPOS_CAMA,
  type GrupoCamas,
  type TipoCama,
} from "@/lib/camas";

/** Una habitación tal como la edita el panel. */
export interface HabitacionPanel {
  id: string;
  nombre: string;
  descripcion: string;
  fotos: string[];
  camas: string[]; // una entrada por cama: ["king", "litera", "litera"]
  precios: number[]; // posición 0 = 1 persona
}

// Mismos topes que lib/booking/habitaciones.ts (no se importa: ese archivo usa
// la base y no puede viajar al navegador). El servidor vuelve a validarlos.
const MAX_FOTOS = 12;
const MAX_PERSONAS = 10;
const MAX_POR_TIPO = 6;
const DESCRIPCION_MAX = 600;
const TIPOS = Object.keys(TIPOS_CAMA) as TipoCama[];
// Lado mayor de la foto que se sube. Es el ancho más grande que sirve el sitio
// (deviceSizes en next.config): más grande no se ve mejor, solo pesa más.
const LADO_MAX = 1920;

function mxn(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

/** Igual que el servidor: un solo espacio entre palabras y sin espacios en las orillas. */
function limpiar(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** "1,140" o "$1140" → 1140. Vacío → 0 (el servidor lo rechaza con su mensaje). */
function aNumero(texto: string): number {
  return Number(texto.replace(/[^\d]/g, "")) || 0;
}

/**
 * Reduce la foto en el navegador antes de subirla: una del celular pesa 3–8 MB
 * y Vercel corta las peticiones de más de 4.5 MB. Sale en JPEG de ~300 KB.
 */
async function reducirFoto(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bmp) throw new Error(`No pude abrir «${file.name}». Prueba con una foto JPG o PNG.`);
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error(`No pude preparar «${file.name}».`))),
      "image/jpeg",
      0.82,
    ),
  );
}

export function HabitacionesClient({ habitaciones }: { habitaciones: HabitacionPanel[] }) {
  if (habitaciones.length === 0)
    return <p className="k-empty">No hay habitaciones a la venta en este momento.</p>;
  return (
    <div className="grid gap-6">
      {habitaciones.map((h) => (
        <TarjetaHabitacion key={h.id} h={h} />
      ))}
    </div>
  );
}

function TarjetaHabitacion({ h }: { h: HabitacionPanel }) {
  const router = useRouter();
  const [precios, setPrecios] = useState(h.precios.map(String));
  const [fotos, setFotos] = useState(h.fotos);
  const [camas, setCamas] = useState<GrupoCamas[]>(() => agruparCamas(h.camas));
  const [descripcion, setDescripcion] = useState(h.descripcion);
  const [subiendo, setSubiendo] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  const numeros = precios.map(aNumero);
  const listaCamas = desagruparCamas(camas);
  const hayCambios =
    JSON.stringify(numeros) !== JSON.stringify(h.precios) ||
    JSON.stringify(fotos) !== JSON.stringify(h.fotos) ||
    JSON.stringify(listaCamas) !== JSON.stringify(h.camas) ||
    limpiar(descripcion) !== h.descripcion;
  // Cada tipo de cama va en una sola fila: «Agregar» ofrece uno que no esté.
  const tipoLibre = TIPOS.find((t) => !camas.some((c) => c.tipo === t));
  const desde = Math.min(...numeros.filter((n) => n > 0));

  function tocar() {
    setError(null);
    setGuardado(false);
  }

  function cambiarPersonas(n: number) {
    tocar();
    // Al agregar personas, la fila nueva arranca con el precio de la última
    // para que no quede vacía.
    setPrecios((p) =>
      n > p.length ? [...p, ...Array(n - p.length).fill(p[p.length - 1] ?? "")] : p.slice(0, n),
    );
  }

  function cambiarPrecio(i: number, valor: string) {
    tocar();
    setPrecios((p) => p.map((v, j) => (j === i ? valor : v)));
  }

  function cambiarCama(i: number, cambio: Partial<GrupoCamas>) {
    tocar();
    setCamas((c) => c.map((g, j) => (j === i ? { ...g, ...cambio } : g)));
  }

  function agregarCama() {
    if (!tipoLibre) return;
    tocar();
    setCamas((c) => [...c, { tipo: tipoLibre, cantidad: 1 }]);
  }

  function quitarCama(i: number) {
    tocar();
    setCamas((c) => c.filter((_, j) => j !== i));
  }

  function mover(i: number, a: number) {
    tocar();
    setFotos((f) => {
      const copia = [...f];
      const [foto] = copia.splice(i, 1);
      copia.splice(a, 0, foto);
      return copia;
    });
  }

  function quitar(i: number) {
    tocar();
    setFotos((f) => f.filter((_, j) => j !== i));
  }

  async function subir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    tocar();
    const libres = MAX_FOTOS - fotos.length;
    const archivos = Array.from(lista).slice(0, libres);
    if (archivos.length < lista.length)
      setError(`Caben ${MAX_FOTOS} fotos por habitación: se subieron solo ${archivos.length}.`);
    // Una por una: subirlas todas a la vez satura la conexión del hotel.
    for (const archivo of archivos) {
      setSubiendo((n) => n + 1);
      try {
        const cuerpo = new FormData();
        cuerpo.append("foto", await reducirFoto(archivo), "foto.jpg");
        const res = await fetch("/api/admin/fotos", { method: "POST", body: cuerpo });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo subir la foto.");
        setFotos((f) => [...f, data.url]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
    if (archivoRef.current) archivoRef.current.value = "";
  }

  function deshacer() {
    tocar();
    setPrecios(h.precios.map(String));
    setFotos(h.fotos);
    setCamas(agruparCamas(h.camas));
    setDescripcion(h.descripcion);
  }

  async function guardar() {
    tocar();
    setGuardando(true);
    const res = await fetch(`/api/admin/habitaciones/${h.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precios: numeros, fotos, camas: listaCamas, descripcion }),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(false);
    if (!res.ok || !data.ok) {
      setError(data.error ?? "No se pudo guardar.");
      return;
    }
    setGuardado(true);
    router.refresh();
  }

  return (
    <article className="k-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="k-section-title text-[1.05rem]">{h.nombre}</h2>
        <p className="text-sm text-muted-foreground">
          {Number.isFinite(desde) ? `Desde ${mxn(desde)} · ` : ""}hasta {precios.length}{" "}
          {precios.length === 1 ? "persona" : "personas"}
        </p>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ── Fotos ──────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-medium">Fotos</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            La primera es la portada en el sitio. Ordénalas con las flechas.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fotos.map((src, i) => (
              <li key={src} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="relative aspect-[4/3] bg-muted">
                  <Image
                    src={src}
                    alt={`${h.nombre}, foto ${i + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 240px"
                    className="object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
                      Portada
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between px-1 py-0.5">
                  <div className="flex">
                    <BotonIcono
                      etiqueta="Mover a la izquierda"
                      disabled={i === 0}
                      onClick={() => mover(i, i - 1)}
                    >
                      <ArrowLeft className="size-4" />
                    </BotonIcono>
                    <BotonIcono
                      etiqueta="Mover a la derecha"
                      disabled={i === fotos.length - 1}
                      onClick={() => mover(i, i + 1)}
                    >
                      <ArrowRight className="size-4" />
                    </BotonIcono>
                    <BotonIcono
                      etiqueta="Poner de portada"
                      disabled={i === 0}
                      onClick={() => mover(i, 0)}
                    >
                      <Star className="size-4" />
                    </BotonIcono>
                  </div>
                  <BotonIcono
                    etiqueta="Quitar foto"
                    disabled={fotos.length === 1}
                    onClick={() => quitar(i)}
                    peligro
                  >
                    <Trash2 className="size-4" />
                  </BotonIcono>
                </div>
              </li>
            ))}
            {subiendo > 0 && (
              <li className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                Subiendo {subiendo > 1 ? `${subiendo} fotos` : "foto"}…
              </li>
            )}
            {fotos.length + subiendo < MAX_FOTOS && (
              <li>
                <button
                  type="button"
                  onClick={() => archivoRef.current?.click()}
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-brand hover:text-foreground"
                >
                  <ImagePlus className="size-5" />
                  Agregar fotos
                </button>
              </li>
            )}
          </ul>
          <input
            ref={archivoRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => subir(e.target.files)}
          />
        </section>

        <div className="grid content-start gap-6">
          {/* ── Precios ────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-medium">Precio por noche</h3>
            <div className="mt-3 grid gap-1.5">
              <Label htmlFor={`personas-${h.id}`}>Máximo de personas</Label>
              <select
                id={`personas-${h.id}`}
                value={precios.length}
                onChange={(e) => cambiarPersonas(Number(e.target.value))}
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                {Array.from({ length: MAX_PERSONAS }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "persona" : "personas"}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 grid gap-2">
              {precios.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Label htmlFor={`precio-${h.id}-${i}`} className="w-24 shrink-0 font-normal">
                    {i === 0 ? "1 persona" : `${i + 1} personas`}
                  </Label>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id={`precio-${h.id}-${i}`}
                      inputMode="numeric"
                      value={p}
                      onChange={(e) => cambiarPrecio(i, e.target.value)}
                      className="pl-6 tabular-nums"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Si cobras lo mismo sin importar cuántos sean, pon el mismo precio en todas las
              filas. Las temporadas suben o bajan estos precios en ciertas fechas. Las reservas
              ya hechas no cambian.
            </p>
          </section>

          {/* ── Camas ──────────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-medium">Camas</h3>
            <div className="mt-3 grid gap-2">
              {camas.map((c, i) => (
                // Por posición, no por tipo: cambiar el tipo no debe rehacer la fila.
                <div key={i} className="flex items-center gap-2">
                  <select
                    aria-label="Cuántas camas"
                    value={c.cantidad}
                    onChange={(e) => cambiarCama(i, { cantidad: Number(e.target.value) })}
                    className="h-9 w-16 shrink-0 rounded-lg border border-input bg-transparent px-2 text-sm tabular-nums"
                  >
                    {Array.from({ length: MAX_POR_TIPO }, (_, n) => n + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Tipo de cama"
                    value={c.tipo}
                    onChange={(e) => cambiarCama(i, { tipo: e.target.value as TipoCama })}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm"
                  >
                    {TIPOS.map((t) => (
                      <option
                        key={t}
                        value={t}
                        disabled={t !== c.tipo && camas.some((otra) => otra.tipo === t)}
                      >
                        {TIPOS_CAMA[t].opcion}
                      </option>
                    ))}
                  </select>
                  <BotonIcono
                    etiqueta="Quitar estas camas"
                    disabled={camas.length === 1}
                    onClick={() => quitarCama(i)}
                    peligro
                  >
                    <Trash2 className="size-4" />
                  </BotonIcono>
                </div>
              ))}
            </div>
            {tipoLibre && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={agregarCama}
                className="mt-2 gap-1.5"
              >
                <Plus className="size-4" /> Agregar otro tipo de cama
              </Button>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              En el sitio se lee: «{camasCorto(listaCamas)}». Si cambias las camas, revisa
              que la descripción diga lo mismo.
            </p>
          </section>
        </div>
      </div>

      {/* ── Descripción ──────────────────────────────────────── */}
      <section className="mt-6 grid gap-1.5">
        <Label htmlFor={`descripcion-${h.id}`}>Descripción</Label>
        <textarea
          id={`descripcion-${h.id}`}
          rows={3}
          maxLength={DESCRIPCION_MAX}
          value={descripcion}
          onChange={(e) => {
            tocar();
            setDescripcion(e.target.value);
          }}
          className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed"
        />
        <p className="text-xs text-muted-foreground">
          Es el texto que sale bajo el nombre de la habitación en el sitio.
        </p>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
        {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
        {guardado && !error && (
          <p className="mr-auto flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="size-4" /> Guardado. El sitio ya muestra los cambios.
          </p>
        )}
        {hayCambios && (
          <Button type="button" variant="ghost" onClick={deshacer} disabled={guardando}>
            Deshacer
          </Button>
        )}
        <Button
          type="button"
          onClick={guardar}
          disabled={!hayCambios || guardando || subiendo > 0}
          className="gap-2"
        >
          {guardando && <Loader2 className="size-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </article>
  );
}

function BotonIcono({
  etiqueta,
  disabled,
  onClick,
  peligro = false,
  children,
}: {
  etiqueta: string;
  disabled: boolean;
  onClick: () => void;
  peligro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-1.5 text-muted-foreground transition-colors disabled:opacity-30 ${
        peligro ? "hover:text-destructive" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
