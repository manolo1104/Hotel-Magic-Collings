"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2, Plus, Loader2, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OtaChannelView } from "@/lib/admin/ical";

function fmtSync(v: unknown): string {
  if (!v) return "nunca";
  try {
    return new Date(v as string).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function CanalesClient({
  canales,
  cuartos,
}: {
  canales: OtaChannelView[];
  cuartos: { id: string; numero: string; tipo: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ roomId: "", platform: "booking", icalUrl: "" });
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("add");
    const res = await fetch("/api/admin/canales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok || !data.ok) {
      setError(data.error ?? "No se pudo agregar.");
      return;
    }
    setForm({ roomId: "", platform: "booking", icalUrl: "" });
    router.refresh();
  }
  async function borrar(id: string) {
    if (!confirm("¿Quitar este canal y sus bloqueos importados?")) return;
    setBusy(id);
    await fetch(`/api/admin/canales/${id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }
  async function sincronizar() {
    setBusy("sync");
    setAviso(null);
    const res = await fetch("/api/admin/canales/sync", { method: "POST" });
    const data = await res.json();
    setBusy(null);
    setAviso(
      res.ok
        ? `Sincronización lista: ${data.bloqueos} fechas importadas de ${data.canales} canal(es)${data.errores ? `, ${data.errores} con error` : ""}.`
        : "No se pudo sincronizar.",
    );
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-6 pb-20 sm:px-6 lg:pt-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Canales OTA</h1>
          <p className="text-sm text-muted-foreground">
            Importa reservas de Booking / Expedia para evitar overbooking
          </p>
        </div>
        {canales.length > 0 && (
          <Button onClick={sincronizar} disabled={busy === "sync"} className="gap-2">
            {busy === "sync" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sincronizar ahora
          </Button>
        )}
      </header>

      {aviso && <p className="mt-4 rounded-lg bg-muted px-4 py-2 text-sm">{aviso}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Lista */}
        <div className="grid gap-3">
          {canales.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Aún no hay canales conectados. Agrega el enlace iCal de tu anuncio de Booking.
            </p>
          ) : (
            canales.map((c) => (
              <article key={c.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Globe2 className="size-4 text-brand" />
                      <h2 className="font-medium capitalize">{c.platform}</h2>
                      <span className="text-xs text-muted-foreground">Cuarto {c.numero}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{c.icalUrl}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Última sync: {fmtSync(c.lastSync)} ·{" "}
                      {c.lastStatus === "ok"
                        ? `${c.blocksFound} fechas`
                        : c.lastStatus === "error"
                          ? "error"
                          : "pendiente"}
                    </p>
                  </div>
                  <button
                    onClick={() => borrar(c.id)}
                    disabled={busy === c.id}
                    aria-label="Quitar canal"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        {/* Form */}
        <form onSubmit={agregar} className="h-fit rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Plus className="size-4 text-brand" /> Conectar canal
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            En Booking/Expedia, copia el enlace iCal de exportación del calendario de tu habitación.
          </p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="c-room">Cuarto</Label>
              <select
                id="c-room"
                required
                value={form.roomId}
                onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Elige…</option>
                {cuartos.map((r) => (
                  <option key={r.id} value={r.id}>{r.numero} · {r.tipo}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-plat">Plataforma</Label>
              <select
                id="c-plat"
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                <option value="booking">Booking</option>
                <option value="expedia">Expedia</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-url">Enlace iCal</Label>
              <Input
                id="c-url"
                required
                placeholder="https://…/calendar.ics"
                value={form.icalUrl}
                onChange={(e) => setForm((f) => ({ ...f, icalUrl: e.target.value }))}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy === "add"} className="w-full">
              Conectar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
