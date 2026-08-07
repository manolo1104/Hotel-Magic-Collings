"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Plus, Wrench, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CleaningRoom, MaintTask } from "@/lib/admin/operations";
import type { ChecklistItem } from "@/lib/admin/cleaning-config";

export function OperacionesClient({
  hoy,
  cuartos,
  tareas,
  items,
}: {
  hoy: string;
  cuartos: CleaningRoom[];
  tareas: MaintTask[];
  items: ChecklistItem[];
}) {
  const [tab, setTab] = useState<"limpieza" | "mant">("limpieza");

  return (
    <div className="w-full max-w-[1200px]">
      <header>
        <p className="k-eyebrow">Panel</p>
        <h1 className="k-title">Operaciones</h1>
        <p className="k-subtitle">Limpieza del día y mantenimiento preventivo</p>
      </header>

      <div className="k-tabs mt-7">
        <button
          onClick={() => setTab("limpieza")}
          data-active={tab === "limpieza"}
          className="k-tab"
        >
          <Sparkles className="size-4" /> Limpieza hoy
        </button>
        <button onClick={() => setTab("mant")} data-active={tab === "mant"} className="k-tab">
          <Wrench className="size-4" /> Mantenimiento
        </button>
      </div>

      {tab === "limpieza" ? (
        <div className="mt-5 grid gap-2.5">
          {cuartos.map((c) => (
            <CleaningCard key={c.roomId} cuarto={c} fecha={hoy} items={items} />
          ))}
        </div>
      ) : (
        <Mantenimiento tareas={tareas} />
      )}
    </div>
  );
}

function CleaningCard({
  cuarto,
  fecha,
  items,
}: {
  cuarto: CleaningRoom;
  fecha: string;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set(cuarto.itemsCompletados));
  const [personal, setPersonal] = useState(cuarto.personal);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  function toggle(id: string) {
    setDone((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  async function guardar() {
    setSaving(true);
    setOk(false);
    const res = await fetch("/api/admin/operaciones/limpieza", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: cuarto.roomId,
        fecha,
        itemsCompletados: Array.from(done),
        totalItems: items.length,
        personal,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setOk(true);
      setTimeout(() => setOk(false), 1500);
      router.refresh();
    }
  }

  const completo = done.size >= items.length;
  const badge = completo
    ? { t: "Completa", c: "bg-support/12 text-support" }
    : done.size > 0
      ? { t: "En proceso", c: "bg-amber-500/15 text-amber-700" }
      : { t: "Pendiente", c: "bg-muted text-muted-foreground" };

  return (
    <article className="k-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-[var(--k-forest)]">Cuarto {cuarto.numero}</h2>
          <span className="text-xs text-muted-foreground">{cuarto.tipo}</span>
          {cuarto.saleHoy && (
            <span className="k-badge bg-amber-500/15 text-amber-700">Sale hoy</span>
          )}
          {cuarto.ocupado && !cuarto.saleHoy && (
            <span className="k-badge bg-brand/10 text-brand">Ocupado</span>
          )}
        </div>
        <span className={`k-badge ${badge.c}`}>
          {badge.t} · {done.size}/{items.length}
        </span>
      </div>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {items.map((it) => {
          const on = done.has(it.id);
          return (
            <button
              key={it.id}
              onClick={() => toggle(it.id)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            >
              <span className={`flex size-5 items-center justify-center rounded-md border transition-colors ${on ? "border-support bg-support text-white" : "border-input"}`}>
                {on && <Check className="size-3.5" />}
              </span>
              <span className={on ? "text-muted-foreground line-through" : ""}>{it.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Input
          placeholder="Quién limpió (opcional)"
          value={personal}
          onChange={(e) => setPersonal(e.target.value)}
          className="h-9 max-w-[220px]"
        />
        <Button onClick={guardar} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {ok ? "Guardado" : "Guardar"}
        </Button>
      </div>
    </article>
  );
}

function Mantenimiento({ tareas }: { tareas: MaintTask[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ ambito: "hotel", tarea: "", frecuenciaDias: "30" });
  const [busy, setBusy] = useState<string | null>(null);

  async function done(id: string) {
    setBusy(id);
    await fetch("/api/admin/operaciones/mantenimiento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "done", id }),
    });
    setBusy(null);
    router.refresh();
  }
  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    await fetch("/api/admin/operaciones/mantenimiento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ...form, frecuenciaDias: Number(form.frecuenciaDias) }),
    });
    setForm({ ambito: "hotel", tarea: "", frecuenciaDias: "30" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid gap-2.5">
        {tareas.map((t) => {
          const tag = t.overdue
            ? { t: "Vencida", c: "bg-destructive/10 text-destructive" }
            : (t.diasRestantes ?? 99) <= 3
              ? { t: "Próxima", c: "bg-amber-500/15 text-amber-700" }
              : { t: "Al día", c: "bg-support/12 text-support" };
          return (
            <article key={t.id} className="k-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-[var(--k-forest)]">{t.tarea}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t.ambito === "hotel" ? "Hotel" : `Cuarto ${t.ambito}`} · cada {t.frecuenciaDias} días
                    {t.proximaVez ? ` · próxima: ${t.proximaVez}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`k-badge ${tag.c}`}>{tag.t}</span>
                  <Button onClick={() => done(t.id)} disabled={busy === t.id} size="sm" variant="secondary" className="gap-1.5">
                    {busy === t.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Hecho
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <form onSubmit={agregar} className="k-card h-fit p-5 sm:p-6">
        <h3 className="k-section-title">
          <Plus className="size-4 text-[var(--k-sage)]" /> Agregar tarea
        </h3>
        <div className="mt-4 grid gap-3">
          <Input
            placeholder="Tarea (ej. limpieza de tinaco)"
            required
            value={form.tarea}
            onChange={(e) => setForm((f) => ({ ...f, tarea: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Ámbito (hotel o 101)"
              value={form.ambito}
              onChange={(e) => setForm((f) => ({ ...f, ambito: e.target.value }))}
            />
            <Input
              type="number"
              min={1}
              placeholder="Cada N días"
              value={form.frecuenciaDias}
              onChange={(e) => setForm((f) => ({ ...f, frecuenciaDias: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={busy === "add"} className="w-full">
            Agregar
          </Button>
        </div>
      </form>
    </div>
  );
}
