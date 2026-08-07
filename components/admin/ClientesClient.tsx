"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, Loader2, MessageCircle, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { GuestProfile } from "@/lib/admin/crm";

function mxn(n: number) {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}
function fmt(iso: string) {
  if (!iso) return "—";
  try {
    return format(new Date(`${iso}T12:00:00`), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}

export function ClientesClient({ perfiles }: { perfiles: GuestProfile[] }) {
  const [q, setQ] = useState("");
  const lista = perfiles.filter(
    (p) => !q || `${p.nombre} ${p.email} ${p.telefono}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="w-full max-w-[1200px]">
      <header>
        <p className="k-eyebrow">Panel</p>
        <h1 className="k-title">Clientes</h1>
        <p className="k-subtitle">
          {perfiles.length} huéspedes con correo registrado
        </p>
      </header>

      <div className="relative mt-7 max-w-md">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, correo o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      {lista.length === 0 ? (
        <p className="k-empty mt-8">
          {perfiles.length === 0
            ? "Aún no hay clientes con correo. Aparecerán al registrar reservas con email."
            : "Sin resultados."}
        </p>
      ) : (
        <div className="mt-5 grid gap-2.5">
          {lista.map((p) => (
            <ClienteCard key={p.email} p={p} fmt={fmt} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClienteCard({ p, fmt }: { p: GuestProfile; fmt: (s: string) => string }) {
  const [notas, setNotas] = useState(p.notas);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const wa = p.telefono.replace(/[^0-9]/g, "");

  async function guardar() {
    setSaving(true);
    setOk(false);
    const res = await fetch("/api/admin/clientes/notas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: p.email, notas }),
    });
    setSaving(false);
    if (res.ok) {
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    }
  }

  return (
    <article className="k-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[var(--k-forest)]">{p.nombre}</h2>
          <p className="text-xs text-muted-foreground">
            {p.email} · {p.telefono}
          </p>
          {p.tiposFavoritos.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Prefiere: {p.tiposFavoritos.join(", ")}
            </p>
          )}
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-lg font-semibold tabular-nums tracking-tight text-[var(--k-forest)]">
              {p.totalReservas}
            </div>
            <div className="text-[0.68rem] font-semibold tracking-[0.09em] uppercase text-[var(--k-sage)]">
              reservas
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold tabular-nums tracking-tight text-[var(--k-forest)]">
              {mxn(p.totalGastado)}
            </div>
            <div className="text-[0.68rem] font-semibold tracking-[0.09em] uppercase text-[var(--k-sage)]">
              gastado
            </div>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="mt-4 border-t border-border pt-3">
        <ul className="space-y-1 text-xs text-muted-foreground">
          {p.historial.slice(0, 5).map((h, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {h.ref} · {h.tipo} · {fmt(h.checkin)} → {fmt(h.checkout)}
                {h.estado === "cancelada" ? " (cancelada)" : ""}
              </span>
              <span>{mxn(h.total)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Notas + WhatsApp */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Notas privadas</label>
          <textarea
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
            placeholder="Preferencias, alergias, observaciones…"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={guardar} disabled={saving} variant="secondary" size="sm" className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {ok ? "Guardado" : "Guardar"}
          </Button>
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="k-chip"
          >
            <MessageCircle className="size-4 text-support" /> WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}
