"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NOS_CONOCISTE_OPCIONES } from "@/lib/booking/types";
import type { BookingView } from "@/lib/booking/engine";

export interface TipoOpcion {
  slug: string;
  nombre: string;
  capacidad: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tipos: TipoOpcion[];
  reserva?: BookingView | null;
  onSaved: () => void;
}

const VACIO = {
  nombre: "",
  whatsapp: "",
  email: "",
  slug: "",
  checkin: "",
  checkout: "",
  huespedes: "2",
  total: "",
  montoPagado: "",
  notas: "",
  origen: "manual",
  nosConociste: "",
  estado: "confirmada",
};

export function ReservationModal({ open, onClose, tipos, reserva, onSaved }: Props) {
  const [form, setForm] = useState({ ...VACIO });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editando = Boolean(reserva);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (reserva) {
      setForm({
        nombre: reserva.nombre,
        whatsapp: reserva.whatsapp,
        email: reserva.email ?? "",
        slug: "",
        checkin: reserva.checkin,
        checkout: reserva.checkout,
        huespedes: String(reserva.huespedes),
        total: String(reserva.total),
        montoPagado: String(reserva.montoPagado ?? 0),
        notas: reserva.notas ?? "",
        origen: reserva.origen ?? "manual",
        nosConociste: reserva.nosConociste ?? "",
        estado: reserva.estado,
      });
    } else {
      setForm({ ...VACIO, slug: tipos[0]?.slug ?? "" });
    }
  }, [open, reserva, tipos]);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = reserva
        ? `/api/admin/reservas/${reserva.id}`
        : "/api/admin/reservas";
      const method = reserva ? "PATCH" : "POST";
      const base = {
        nombre: form.nombre,
        whatsapp: form.whatsapp,
        email: form.email || null,
        checkin: form.checkin,
        checkout: form.checkout,
        huespedes: Number(form.huespedes),
        total: form.total === "" ? undefined : Number(form.total),
        montoPagado: form.montoPagado === "" ? undefined : Number(form.montoPagado),
        notas: form.notas,
        nosConociste: form.nosConociste,
      };
      const payload = reserva
        ? { ...base, estado: form.estado }
        : { ...base, slug: form.slug, origen: form.origen };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar.");
        setLoading(false);
        return;
      }
      setLoading(false);
      onSaved();
      onClose();
    } catch {
      setError("Error de conexión.");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* `panel-kora`: el diálogo vive en un portal colgado de <body>, fuera del
          shell del panel. Sin esta clase heredaría la paleta del sitio público
          (papel + terracota) en lugar del tema Kora. */}
      <DialogContent className="panel-kora max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight text-[var(--k-forest)]">
            {editando ? "Editar reserva" : "Nueva reserva"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={guardar} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="m-nombre">Huésped</Label>
            <Input id="m-nombre" required value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="m-wa">WhatsApp / Tel.</Label>
              <Input id="m-wa" required value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-email">Correo</Label>
              <Input id="m-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>

          {!editando && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="m-tipo">Habitación</Label>
                <select
                  id="m-tipo"
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  {tipos.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.nombre} (hasta {t.capacidad})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-origen">Origen</Label>
                <select
                  id="m-origen"
                  value={form.origen}
                  onChange={(e) => set("origen", e.target.value)}
                  className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  <option value="manual">Manual</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="booking">Booking</option>
                  <option value="expedia">Expedia</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="m-in">Llegada</Label>
              <Input id="m-in" type="date" required value={form.checkin} onChange={(e) => set("checkin", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-out">Salida</Label>
              <Input id="m-out" type="date" required value={form.checkout} onChange={(e) => set("checkout", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-hue">Huésp.</Label>
              <Input id="m-hue" type="number" min={1} value={form.huespedes} onChange={(e) => set("huespedes", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="m-total">Total (MXN)</Label>
              <Input id="m-total" type="number" min={0} placeholder="auto" value={form.total} onChange={(e) => set("total", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-pag">Pagado (MXN)</Label>
              <Input id="m-pag" type="number" min={0} value={form.montoPagado} onChange={(e) => set("montoPagado", e.target.value)} />
            </div>
          </div>

          {editando && (
            <div className="grid gap-1.5">
              <Label htmlFor="m-estado">Estado</Label>
              <select
                id="m-estado"
                value={form.estado}
                onChange={(e) => set("estado", e.target.value)}
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                <option value="confirmada">Confirmada</option>
                <option value="pendiente">Pendiente</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="m-conociste">¿De dónde nos conoció?</Label>
            <select
              id="m-conociste"
              value={form.nosConociste}
              onChange={(e) => set("nosConociste", e.target.value)}
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Sin dato</option>
              {NOS_CONOCISTE_OPCIONES.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="m-notas">Notas internas</Label>
            <textarea
              id="m-notas"
              rows={2}
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {editando ? "Guardar" : "Crear reserva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
