"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CalendarData, GanttBooking } from "@/lib/booking/engine";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function cellCls(s: string): string {
  if (s === "reservada") return "bg-brand";
  if (s === "bloqueada") return "bg-amber-400";
  return "bg-support/10";
}

export function CalendarioClient({
  initialCalendar,
  initialGantt,
}: {
  initialCalendar: CalendarData;
  initialGantt: GanttBooking[];
}) {
  const [cal, setCal] = useState(initialCalendar);
  const [gantt, setGantt] = useState(initialGantt);
  const [vista, setVista] = useState<"disp" | "time">("disp");
  const [loading, setLoading] = useState(false);
  const [bloq, setBloq] = useState({ roomId: "", checkin: "", checkout: "", nota: "" });
  const [err, setErr] = useState<string | null>(null);

  async function cargar(year: number, month: number) {
    setLoading(true);
    const res = await fetch(`/api/admin/calendario?year=${year}&month=${month}`);
    const data = await res.json();
    if (data.ok) {
      setCal(data.calendar);
      setGantt(data.gantt);
    }
    setLoading(false);
  }
  function prev() {
    const m = cal.month === 1 ? 12 : cal.month - 1;
    const y = cal.month === 1 ? cal.year - 1 : cal.year;
    cargar(y, m);
  }
  function next() {
    const m = cal.month === 12 ? 1 : cal.month + 1;
    const y = cal.month === 12 ? cal.year + 1 : cal.year;
    cargar(y, m);
  }

  async function crearBloqueo(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/admin/bloqueos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bloq),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setBloq({ roomId: "", checkin: "", checkout: "", nota: "" });
      cargar(cal.year, cal.month);
    } else {
      setErr(data.error ?? "No se pudo bloquear.");
    }
  }
  async function quitar(id: string) {
    const res = await fetch(`/api/admin/bloqueos/${id}`, { method: "DELETE" });
    if (res.ok) cargar(cal.year, cal.month);
  }

  const numeroDe = (id: string) => cal.rooms.find((r) => r.id === id)?.numero ?? id;

  return (
    <div className="w-full max-w-[1200px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="k-eyebrow">Panel</p>
          <h1 className="k-title">Calendario</h1>
          <p className="k-subtitle">Disponibilidad del hotel y bloqueos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="lg" onClick={prev} aria-label="Mes anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[150px] text-center text-sm font-semibold text-[var(--k-forest)]">
            {loading ? "…" : `${MESES[cal.month - 1]} ${cal.year}`}
          </span>
          <Button variant="secondary" size="lg" onClick={next} aria-label="Mes siguiente">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      {/* Toggle de vista */}
      <div className="k-tabs mt-7">
        <button onClick={() => setVista("disp")} data-active={vista === "disp"} className="k-tab">
          Disponibilidad
        </button>
        <button onClick={() => setVista("time")} data-active={vista === "time"} className="k-tab">
          Línea de tiempo
        </button>
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-support/10" />Libre</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-brand" />Reservada</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-amber-400" />Bloqueada</span>
      </div>

      {vista === "disp" ? (
        <div className="k-card mt-4 overflow-x-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-[0.09em] uppercase text-[var(--k-sage)]">
                  Cuarto
                </th>
                {cal.days.map((d) => (
                  <th key={d} className="w-7 px-0 py-2 text-center font-normal text-muted-foreground">
                    {Number(d.slice(-2))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cal.rooms.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5 whitespace-nowrap">
                    <span className="font-semibold text-[var(--k-forest)]">{r.numero}</span>{" "}
                    <span className="text-muted-foreground">{r.tipo}</span>
                  </td>
                  {cal.days.map((d) => (
                    <td key={d} className="p-0.5">
                      <div
                        className={`mx-auto h-6 w-6 rounded-sm ${cellCls(cal.grid[r.id]?.[d] ?? "libre")}`}
                        title={`${r.numero} · ${d} · ${cal.grid[r.id]?.[d] ?? "libre"}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="k-card mt-4 overflow-x-auto p-4 sm:p-5">
          {gantt.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin reservas en {MESES[cal.month - 1]}.
            </p>
          ) : (
            <div className="space-y-2" style={{ minWidth: 520 }}>
              {gantt.map((g, i) => {
                const total = cal.days.length;
                const idxIn = Math.max(0, cal.days.indexOf(g.checkin));
                const idxOut = g.checkout > cal.days[total - 1] ? total : cal.days.indexOf(g.checkout);
                const start = idxIn < 0 ? 0 : idxIn;
                const end = idxOut < 0 ? total : idxOut;
                const left = (start / total) * 100;
                const width = Math.max(2, ((end - start) / total) * 100);
                return (
                  <div key={i} className="relative h-7 rounded-md bg-secondary">
                    <div
                      className="absolute top-0 flex h-7 items-center overflow-hidden rounded-md bg-brand px-2 text-xs font-medium text-brand-foreground"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${g.nombre} · ${g.numero}`}
                    >
                      <span className="truncate">{g.numero} · {g.nombre}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bloquear fechas */}
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <form onSubmit={crearBloqueo} className="k-card p-5 sm:p-6">
          <h2 className="k-section-title">
            <Lock className="size-4 text-[var(--k-sage)]" /> Bloquear fechas
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Para mantenimiento o reservas tomadas por otro medio. El cuarto deja de aparecer disponible.
          </p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="b-room">Cuarto</Label>
              <select
                id="b-room"
                required
                value={bloq.roomId}
                onChange={(e) => setBloq((b) => ({ ...b, roomId: e.target.value }))}
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Elige…</option>
                {cal.rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.numero} · {r.tipo}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="b-in">Desde</Label>
                <Input id="b-in" type="date" required value={bloq.checkin} onChange={(e) => setBloq((b) => ({ ...b, checkin: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="b-out">Hasta</Label>
                <Input id="b-out" type="date" required value={bloq.checkout} onChange={(e) => setBloq((b) => ({ ...b, checkout: e.target.value }))} />
              </div>
            </div>
            <Input placeholder="Nota (opcional)" value={bloq.nota} onChange={(e) => setBloq((b) => ({ ...b, nota: e.target.value }))} />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full">Bloquear</Button>
          </div>
        </form>

        <div className="k-card p-5 sm:p-6">
          <h2 className="k-section-title">Bloqueos del mes</h2>
          {cal.bloqueos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No hay bloqueos este mes.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {cal.bloqueos.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <span>
                    <strong>{numeroDe(b.roomId)}</strong> · {b.checkin} → {b.checkout}
                    {b.motivo === "ota" ? " · OTA" : ""}
                    {b.nota ? ` · ${b.nota}` : ""}
                  </span>
                  {b.motivo !== "ota" && (
                    <button onClick={() => quitar(b.id)} aria-label="Quitar bloqueo" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando…
        </div>
      )}
    </div>
  );
}
