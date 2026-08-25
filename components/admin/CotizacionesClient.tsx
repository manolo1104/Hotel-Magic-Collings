"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Printer, Mail, ArrowRightCircle, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TipoOpcion } from "./ReservationModal";
import type { QuoteView } from "@/lib/booking/engine";

function mxn(n: number) {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}
function fmt(iso: string) {
  try {
    return format(new Date(`${iso}T12:00:00`), "d MMM", { locale: es });
  } catch {
    return iso;
  }
}

const ESTADO: Record<string, { t: string; c: string }> = {
  borrador: { t: "Borrador", c: "bg-muted text-muted-foreground" },
  enviada: { t: "Enviada", c: "bg-amber-500/15 text-amber-700" },
  aceptada: { t: "Aceptada", c: "bg-support/12 text-support" },
  expirada: { t: "Expirada", c: "bg-destructive/10 text-destructive" },
};

const VACIO = {
  cliente: "",
  telefono: "",
  email: "",
  slug: "",
  checkin: "",
  checkout: "",
  huespedes: "2",
  precioTotal: "",
  notas: "",
  estado: "borrador",
};

export function CotizacionesClient({
  initial,
  tipos,
}: {
  initial: QuoteView[];
  tipos: TipoOpcion[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...VACIO });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Nombre del tipo de una cotización vieja cuya categoría ya no se ofrece
  // (interna o retirada). Sin esto el desplegable enseñaría el primer tipo de
  // la lista como si fuera el suyo.
  const [tipoRetirado, setTipoRetirado] = useState<string | null>(null);

  function abrirNueva() {
    setEditId(null);
    setTipoRetirado(null);
    setForm({ ...VACIO, slug: tipos[0]?.slug ?? "" });
    setError(null);
    setOpen(true);
  }
  function abrirEditar(q: QuoteView) {
    setEditId(q.id);
    // `quotes.slug` guarda el NOMBRE del tipo, no su slug: para preseleccionar
    // el desplegable hay que buscarlo por id (y caer al nombre si es antigua).
    const actual =
      tipos.find((t) => t.id === q.roomTypeId) ??
      tipos.find((t) => t.nombre === q.nombreTipo);
    setTipoRetirado(actual ? null : q.nombreTipo);
    setForm({
      cliente: q.cliente,
      telefono: q.telefono,
      email: q.email ?? "",
      slug: actual?.slug ?? "",
      checkin: q.checkin,
      checkout: q.checkout,
      huespedes: String(q.huespedes),
      precioTotal: String(q.precioTotal),
      notas: q.notas ?? "",
      estado: q.estado,
    });
    setError(null);
    setOpen(true);
  }
  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const url = editId ? `/api/admin/cotizaciones/${editId}` : "/api/admin/cotizaciones";
    const method = editId ? "PATCH" : "POST";
    const base = {
      cliente: form.cliente,
      telefono: form.telefono,
      email: form.email || null,
      checkin: form.checkin,
      checkout: form.checkout,
      huespedes: Number(form.huespedes),
      precioTotal: form.precioTotal === "" ? undefined : Number(form.precioTotal),
      notas: form.notas,
    };
    // `slug` viaja también al editar: es el cambio de habitación.
    const payload = editId
      ? { ...base, estado: form.estado, slug: form.slug || undefined }
      : { ...base, slug: form.slug };
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok || !data.ok) {
      setError(data.error ?? "No se pudo guardar.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function convertir(q: QuoteView) {
    if (!confirm(`¿Convertir la cotización de ${q.cliente} en reserva confirmada?`)) return;
    setAviso(null);
    const res = await fetch(`/api/admin/cotizaciones/${q.id}/convertir`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setAviso(res.ok && data.ok ? "Cotización convertida en reserva." : data.error ?? "No se pudo convertir.");
    if (res.ok && data.ok) router.refresh();
  }
  async function eliminar(q: QuoteView) {
    const extra = q.bookingId
      ? "\n\nSu reserva NO se borra: sigue en el panel de Reservas."
      : "";
    if (
      !confirm(
        `¿Eliminar para siempre la cotización de ${q.cliente}?\n\nEsto NO se puede deshacer.${extra}`,
      )
    )
      return;
    setAviso(null);
    const res = await fetch(`/api/admin/cotizaciones/${q.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) router.refresh();
    else setAviso(data.error ?? "No se pudo eliminar la cotización.");
  }
  async function enviar(q: QuoteView) {
    setAviso(null);
    const res = await fetch(`/api/admin/cotizaciones/${q.id}/send-email`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setAviso(res.ok && data.ok ? "Cotización enviada por correo." : data.error ?? "No se pudo enviar.");
    if (res.ok) router.refresh();
  }

  return (
    <div className="w-full max-w-[1200px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="k-eyebrow">Panel</p>
          <h1 className="k-title">Cotizaciones</h1>
          <p className="k-subtitle">{initial.length} cotizaciones</p>
        </div>
        <Button size="lg" className="gap-2" onClick={abrirNueva}>
          <Plus className="size-4" /> Nueva cotización
        </Button>
      </header>

      {aviso && (
        <p className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm text-accent-foreground">{aviso}</p>
      )}

      {initial.length === 0 ? (
        <p className="k-empty mt-8">
          Aún no hay cotizaciones. Crea una para enviar un presupuesto a un cliente.
        </p>
      ) : (
        <div className="mt-7 grid gap-2.5">
          {initial.map((q) => {
            const est = ESTADO[q.estado] ?? ESTADO.borrador;
            return (
              <article key={q.id} className="k-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-[var(--k-forest)]">{q.cliente}</h2>
                      <span className={`k-badge ${est.c}`}>{est.t}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {q.nombreTipo} · {fmt(q.checkin)} → {fmt(q.checkout)} · {q.noches} noches · {q.huespedes} huésp.
                      {q.bookingId ? " · ya es reserva" : ""}
                    </p>
                  </div>
                  <div className="text-lg font-semibold tabular-nums tracking-tight text-[var(--k-forest)]">
                    {mxn(q.precioTotal)}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3">
                  <Act onClick={() => abrirEditar(q)} icon={<Pencil className="size-4" />} label="Editar" />
                  <Act onClick={() => window.open(`/api/admin/cotizaciones/${q.id}/render?print=1`, "_blank")} icon={<Printer className="size-4" />} label="PDF" />
                  {q.email && <Act onClick={() => enviar(q)} icon={<Mail className="size-4 text-brand" />} label="Enviar" />}
                  {!q.bookingId && (
                    <Act onClick={() => convertir(q)} icon={<ArrowRightCircle className="size-4 text-support" />} label="Convertir a reserva" />
                  )}
                  <Act onClick={() => eliminar(q)} icon={<Trash2 className="size-4 text-destructive" />} label="Eliminar" />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        {/* `panel-kora`: el diálogo vive en un portal colgado de <body>, fuera del
            shell del panel, y sin esta clase heredaría la paleta pública. */}
        <DialogContent className="panel-kora max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold tracking-tight text-[var(--k-forest)]">
              {editId ? "Editar cotización" : "Nueva cotización"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={guardar} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="q-cli">Cliente</Label>
              <Input id="q-cli" required value={form.cliente} onChange={(e) => set("cliente", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="q-tel">WhatsApp / Tel.</Label>
                <Input id="q-tel" required value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="q-mail">Correo</Label>
                <Input id="q-mail" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="q-tipo">Habitación</Label>
              <select id="q-tipo" value={form.slug} onChange={(e) => set("slug", e.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm">
                {tipoRetirado && <option value="">{tipoRetirado} · retirado</option>}
                {tipos.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.nombre} (hasta {t.capacidad})</option>
                ))}
              </select>
              {editId && (
                <p className="text-[11px] text-muted-foreground">
                  Si cambias de habitación y dejas el precio en blanco, se recalcula con
                  la tarifa de la nueva.
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="q-in">Llegada</Label>
                <Input id="q-in" type="date" required value={form.checkin} onChange={(e) => set("checkin", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="q-out">Salida</Label>
                <Input id="q-out" type="date" required value={form.checkout} onChange={(e) => set("checkout", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="q-hue">Huésp.</Label>
                <Input id="q-hue" type="number" min={1} value={form.huespedes} onChange={(e) => set("huespedes", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="q-prc">Precio total (MXN)</Label>
                <Input id="q-prc" type="number" min={0} placeholder="auto" value={form.precioTotal} onChange={(e) => set("precioTotal", e.target.value)} />
              </div>
              {editId && (
                <div className="grid gap-1.5">
                  <Label htmlFor="q-est">Estado</Label>
                  <select id="q-est" value={form.estado} onChange={(e) => set("estado", e.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm">
                    <option value="borrador">Borrador</option>
                    <option value="enviada">Enviada</option>
                    <option value="aceptada">Aceptada</option>
                    <option value="expirada">Expirada</option>
                  </select>
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="q-notas">Notas</Label>
              <textarea id="q-notas" rows={2} value={form.notas} onChange={(e) => set("notas", e.target.value)} className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm" />
            </div>
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading && <Loader2 className="size-4 animate-spin" />}
                {editId ? "Guardar" : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Act({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="k-chip">
      {icon} {label}
    </button>
  );
}
