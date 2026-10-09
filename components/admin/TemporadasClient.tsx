"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { precioDeNoche } from "@/lib/booking/temporadas-calc";
import type { TemporadaView, TipoAjuste } from "@/lib/booking/temporadas-calc";

/** Categoría con lo que cuesta hoy una noche para 2 personas (la ocupación típica). */
export interface TipoEjemplo {
  id: string;
  nombre: string;
  precioEjemplo: number;
}

const VACIO = {
  id: "",
  nombre: "",
  desde: "",
  hasta: "",
  roomTypeId: "",
  tipoAjuste: "porcentaje" as TipoAjuste,
  valor: "",
};

function mxn(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

/** "2026-10-31" → "31 oct 2026". Se parte la cadena para no cruzar zonas horarias. */
function fecha(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function etiquetaAjuste(t: TemporadaView): string {
  if (t.tipoAjuste === "precio") return `${mxn(t.valor)} por noche`;
  return `${t.valor > 0 ? "+" : ""}${t.valor}%`;
}

export function TemporadasClient({
  temporadas,
  tipos,
}: {
  temporadas: TemporadaView[];
  tipos: TipoEjemplo[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const editando = form.id !== "";
  const valorNum = Number(form.valor);

  // Vista previa: qué le pasa a una noche con lo que hay escrito ahora mismo.
  // Usa `precioDeNoche`, la MISMA función que cobra el motor, para que lo que
  // se ve aquí no pueda separarse de lo que pagará el huésped.
  const preview = useMemo(() => {
    if (!Number.isFinite(valorNum) || form.valor === "") return [];
    const falsa = {
      id: "preview",
      nombre: form.nombre || "Temporada",
      desde: form.desde,
      hasta: form.hasta,
      roomTypeId: null,
      tipoAjuste: form.tipoAjuste,
      valor: valorNum,
      activa: true,
    };
    return tipos
      .filter((t) => !form.roomTypeId || t.id === form.roomTypeId)
      .map((t) => ({
        nombre: t.nombre,
        antes: t.precioEjemplo,
        despues: precioDeNoche(t.precioEjemplo, falsa),
      }));
  }, [form.nombre, form.desde, form.hasta, form.roomTypeId, form.tipoAjuste, form.valor, valorNum, tipos]);

  function set<K extends keyof typeof VACIO>(k: K, v: (typeof VACIO)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function editar(t: TemporadaView) {
    setError(null);
    setForm({
      id: t.id,
      nombre: t.nombre,
      desde: t.desde,
      hasta: t.hasta,
      roomTypeId: t.roomTypeId ?? "",
      tipoAjuste: t.tipoAjuste,
      valor: String(t.valor),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("save");
    const cuerpo = {
      nombre: form.nombre,
      desde: form.desde,
      hasta: form.hasta,
      roomTypeId: form.roomTypeId || null,
      tipoAjuste: form.tipoAjuste,
      valor: valorNum,
    };
    const res = await fetch(
      editando ? `/api/admin/temporadas/${form.id}` : "/api/admin/temporadas",
      {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      },
    );
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || !data.ok) {
      setError(data.error ?? "No se pudo guardar.");
      return;
    }
    setForm(VACIO);
    router.refresh();
  }

  async function alternar(t: TemporadaView) {
    setBusy(t.id);
    await fetch(`/api/admin/temporadas/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !t.activa }),
    });
    setBusy(null);
    router.refresh();
  }

  async function borrar(t: TemporadaView) {
    if (!confirm(`¿Borrar la temporada "${t.nombre}"? Las reservas ya hechas no cambian.`))
      return;
    setBusy(t.id);
    await fetch(`/api/admin/temporadas/${t.id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      {/* ── Lista ─────────────────────────────────────────── */}
      {/* `content-start`: sin él las tarjetas se estiran para llenar el alto
          de la columna del formulario y quedan medio vacías. */}
      <div className="grid content-start gap-3">
        {temporadas.length === 0 ? (
          <p className="k-empty">
            Todavía no hay temporadas. Mientras no crees ninguna, todas las noches se
            cobran a la tarifa normal de cada habitación.
          </p>
        ) : (
          temporadas.map((t) => (
            <article
              key={t.id}
              className={`k-card p-4 sm:p-5 ${t.activa ? "" : "opacity-60"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarRange className="size-4 text-brand" />
                    <h2 className="font-medium">{t.nombre}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.tipoAjuste === "precio"
                          ? "bg-muted text-foreground"
                          : t.valor > 0
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-500"
                      }`}
                    >
                      {etiquetaAjuste(t)}
                    </span>
                    {!t.activa && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        Apagada
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Noches del {fecha(t.desde)} al {fecha(t.hasta)} · {t.noches}{" "}
                    {t.noches === 1 ? "noche" : "noches"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.nombreTipo}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => alternar(t)}
                    disabled={busy === t.id}
                    className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t.activa ? "Apagar" : "Encender"}
                  </button>
                  <button
                    onClick={() => editar(t)}
                    aria-label="Editar temporada"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => borrar(t)}
                    disabled={busy === t.id}
                    aria-label="Borrar temporada"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* ── Formulario ────────────────────────────────────── */}
      <div className="k-card p-4 sm:p-5">
        <form onSubmit={guardar}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="k-section-title text-[1.05rem]">
              {editando ? "Editar temporada" : "Nueva temporada"}
            </h2>
            {editando && (
              <button
                type="button"
                onClick={() => {
                  setForm(VACIO);
                  setError(null);
                }}
                aria-label="Cancelar edición"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Las dos fechas son <strong>noches</strong> y las dos entran: del 31 de
            octubre al 2 de noviembre son tres noches más caras.
          </p>

          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-nombre">Nombre</Label>
              <Input
                id="t-nombre"
                required
                maxLength={60}
                placeholder="Xantolo 2026"
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="t-desde">Primera noche</Label>
                <Input
                  id="t-desde"
                  type="date"
                  required
                  value={form.desde}
                  onChange={(e) => set("desde", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="t-hasta">Última noche</Label>
                <Input
                  id="t-hasta"
                  type="date"
                  required
                  min={form.desde || undefined}
                  value={form.hasta}
                  onChange={(e) => set("hasta", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="t-tipo">Aplica a</Label>
              <select
                id="t-tipo"
                value={form.roomTypeId}
                onChange={(e) => set("roomTypeId", e.target.value)}
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Todas las habitaciones</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="t-ajuste">Cómo se ajusta</Label>
                <select
                  id="t-ajuste"
                  value={form.tipoAjuste}
                  onChange={(e) => set("tipoAjuste", e.target.value as TipoAjuste)}
                  className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  <option value="porcentaje">Por porcentaje</option>
                  <option value="precio">Precio fijo</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="t-valor">
                  {form.tipoAjuste === "precio" ? "Precio por noche" : "Porcentaje"}
                </Label>
                <Input
                  id="t-valor"
                  type="number"
                  required
                  step={1}
                  min={form.tipoAjuste === "precio" ? 1 : -90}
                  max={form.tipoAjuste === "precio" ? undefined : 500}
                  placeholder={form.tipoAjuste === "precio" ? "1800" : "20"}
                  value={form.valor}
                  onChange={(e) => set("valor", e.target.value)}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {form.tipoAjuste === "precio"
                ? "Esa noche costará exactamente eso, sin importar la tarifa de la habitación."
                : "Positivo sube el precio (20 = +20%), negativo lo baja (-15 = 15% de descuento)."}
            </p>

            {preview.length > 0 && (
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                <p className="text-xs font-medium text-muted-foreground">
                  Así quedaría la noche (ejemplo con 2 personas)
                </p>
                <ul className="mt-1 grid gap-0.5">
                  {preview.map((p) => (
                    <li key={p.nombre} className="flex justify-between gap-3">
                      <span className="truncate">{p.nombre}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="text-muted-foreground line-through">
                          {mxn(p.antes)}
                        </span>{" "}
                        <strong>{mxn(p.despues)}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={busy === "save"} className="w-full gap-2">
              {busy === "save" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {editando ? "Guardar cambios" : "Crear temporada"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
