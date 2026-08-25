"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Trash2, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CalendarData, GanttBooking, BookingView } from "@/lib/booking/engine";
import { AvailabilityCalendar, type DiaClicado } from "./AvailabilityCalendar";
import { ReservationModal, type TipoOpcion } from "./ReservationModal";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function restarDia(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}
function bonita(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1].toLowerCase()} ${y}`;
}
function noches(desde: string, hasta: string): number {
  return Math.round(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000,
  );
}
/**
 * Qué noches se cierran de verdad. Los rangos son `[desde, hasta)`, igual que un
 * check-in/check-out: la fecha de "Hasta" NO se cierra. Un dueño lee "hasta el
 * 31 de diciembre" como diciembre incluido, así que hay que decírselo antes de
 * que le dé al botón, no después.
 */
function resumenRango(desde: string, hasta: string): string | null {
  if (!desde || !hasta) return null;
  const n = noches(desde, hasta);
  if (n < 1) return null;
  return `${n} ${n === 1 ? "noche" : "noches"}: del ${bonita(desde)} al ${bonita(restarDia(hasta))}. El ${bonita(hasta)} queda libre.`;
}

export function CalendarioClient({
  initialCalendar,
  initialGantt,
  tipos,
  reservas,
  hoy,
}: {
  initialCalendar: CalendarData;
  initialGantt: GanttBooking[];
  tipos: TipoOpcion[];
  reservas: BookingView[];
  hoy: string;
}) {
  const router = useRouter();
  const [cal, setCal] = useState(initialCalendar);
  const [gantt, setGantt] = useState(initialGantt);
  const [vista, setVista] = useState<"disp" | "time">("disp");
  const [loading, setLoading] = useState(false);
  const [bloq, setBloq] = useState({ roomId: "", checkin: "", checkout: "", nota: "" });
  const [err, setErr] = useState<string | null>(null);
  const [okBloq, setOkBloq] = useState<string | null>(null);
  // Formulario espejo del anterior, pero para ABRIR un rango cerrado.
  const [abrir, setAbrir] = useState({ roomId: "", checkin: "", checkout: "" });
  const [errAbrir, setErrAbrir] = useState<string | null>(null);
  const [okAbrir, setOkAbrir] = useState<string | null>(null);
  // Modal de reserva abierto desde una celda del calendario.
  const [modal, setModal] = useState<{
    reserva: BookingView | null;
    defaults: {
      checkin?: string;
      checkout?: string;
      slug?: string;
      roomId?: string;
      numeroCuarto?: string;
    } | null;
  } | null>(null);

  const cargar = useCallback(async (year: number, month: number) => {
    setLoading(true);
    const res = await fetch(`/api/admin/calendario?year=${year}&month=${month}`);
    const data = await res.json();
    if (data.ok) {
      setCal(data.calendar);
      setGantt(data.gantt);
    }
    setLoading(false);
  }, []);

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
  function irHoy() {
    const [y, m] = hoy.split("-").map(Number);
    cargar(y, m);
  }

  // Nueva reserva desde un día libre: el tipo del cuarto y la fecha ya puestos,
  // salida la noche siguiente (una noche, que es lo que el dueño acaba de clicar).
  function nuevaDesdeCalendario(d: DiaClicado) {
    const tipo = tipos.find((t) => t.nombre === d.tipo);
    const [y, m, dd] = d.fecha.split("-").map(Number);
    const salida = new Date(Date.UTC(y, m - 1, dd + 1));
    setModal({
      reserva: null,
      defaults: {
        checkin: d.fecha,
        checkout: salida.toISOString().slice(0, 10),
        slug: tipo?.slug,
        roomId: d.roomId,
        numeroCuarto: d.numero,
      },
    });
  }

  function editarDesdeCalendario(bookingId: string) {
    const r = reservas.find((x) => x.id === bookingId);
    if (r) setModal({ reserva: r, defaults: null });
  }

  async function crearBloqueo(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOkBloq(null);
    const res = await fetch("/api/admin/bloqueos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bloq),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      const cuarto = numeroDe(bloq.roomId);
      const detalle = resumenRango(bloq.checkin, bloq.checkout);
      setOkBloq(
        data.yaEstaba
          ? `El cuarto ${cuarto} YA estaba cerrado en esas fechas. No se creó otro bloqueo.`
          : `Listo: el cuarto ${cuarto} queda cerrado. ${detalle ?? ""}`,
      );
      // Saltar al mes donde EMPIEZA el bloqueo. Sin esto el calendario se
      // quedaba en el mes de hoy y, si el bloqueo era a futuro, no se veía
      // nada: parecía que el botón no había hecho nada.
      const [y, m] = bloq.checkin.split("-").map(Number);
      setBloq({ roomId: "", checkin: "", checkout: "", nota: "" });
      if (y && m) cargar(y, m);
      else cargar(cal.year, cal.month);
    } else {
      setErr(data.error ?? "No se pudo bloquear.");
    }
  }
  async function abrirRango(e: React.FormEvent) {
    e.preventDefault();
    setErrAbrir(null);
    setOkAbrir(null);
    const res = await fetch("/api/admin/bloqueos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(abrir),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      const cuartos = abrir.roomId
        ? `el cuarto ${numeroDe(abrir.roomId)}`
        : "todos los cuartos";
      setOkAbrir(
        `Listo: se abrieron ${data.abiertos} bloqueo(s) en ${cuartos}.` +
          (data.ota
            ? ` ${data.ota} quedaron cerrados porque los puso un canal (Booking/Expedia).`
            : ""),
      );
      const [y, m] = abrir.checkin.split("-").map(Number);
      setAbrir({ roomId: "", checkin: "", checkout: "" });
      if (y && m) cargar(y, m);
      else cargar(cal.year, cal.month);
    } else {
      setErrAbrir(data.error ?? "No se pudieron abrir las fechas.");
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

      {vista === "disp" ? (
        <AvailabilityCalendar
          cal={cal}
          hoy={hoy}
          loading={loading}
          onPrev={prev}
          onNext={next}
          onHoy={irHoy}
          onRefresh={() => cargar(cal.year, cal.month)}
          onNuevaReserva={nuevaDesdeCalendario}
          onEditarReserva={editarDesdeCalendario}
        />
      ) : (
        <div className="k-card mt-4 overflow-x-auto p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <button onClick={prev} aria-label="Mes anterior" className="k-navbtn">
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[150px] text-center text-sm font-semibold text-[var(--k-forest)]">
              {loading ? "…" : `${MESES[cal.month - 1]} ${cal.year}`}
            </span>
            <button onClick={next} aria-label="Mes siguiente" className="k-navbtn">
              <ChevronRight className="size-4" />
            </button>
            <button onClick={irHoy} className="k-navbtn px-3 text-xs font-medium">
              Hoy
            </button>
          </div>
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
            {resumenRango(bloq.checkin, bloq.checkout) && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                Se cerrarán {resumenRango(bloq.checkin, bloq.checkout)}
              </p>
            )}
            <Input placeholder="Nota (opcional)" value={bloq.nota} onChange={(e) => setBloq((b) => ({ ...b, nota: e.target.value }))} />
            {err && <p className="text-sm text-destructive">{err}</p>}
            {okBloq && (
              <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                {okBloq}
              </p>
            )}
            <Button type="submit" className="w-full">Bloquear</Button>
          </div>
        </form>

        {/* Abrir fechas: el reverso exacto del formulario de arriba. Sin esto
            solo se podía reabrir día por día desde la cuadrícula, inservible
            cuando se cerró una temporada entera. */}
        <form onSubmit={abrirRango} className="k-card p-5 sm:p-6">
          <h2 className="k-section-title">
            <Unlock className="size-4 text-[var(--k-sage)]" /> Abrir fechas
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quita los bloqueos de un rango y el cuarto vuelve a venderse. Si un bloqueo
            sobresale del rango, solo se recorta la parte que abres.
          </p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="a-room">Cuarto</Label>
              <select
                id="a-room"
                value={abrir.roomId}
                onChange={(e) => setAbrir((b) => ({ ...b, roomId: e.target.value }))}
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Todos los cuartos</option>
                {cal.rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.numero} · {r.tipo}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="a-in">Desde</Label>
                <Input id="a-in" type="date" required value={abrir.checkin} onChange={(e) => setAbrir((b) => ({ ...b, checkin: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="a-out">Hasta</Label>
                <Input id="a-out" type="date" required value={abrir.checkout} onChange={(e) => setAbrir((b) => ({ ...b, checkout: e.target.value }))} />
              </div>
            </div>
            {resumenRango(abrir.checkin, abrir.checkout) && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                Se abrirán {resumenRango(abrir.checkin, abrir.checkout)}
              </p>
            )}
            {errAbrir && <p className="text-sm text-destructive">{errAbrir}</p>}
            {okAbrir && (
              <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                {okAbrir}
              </p>
            )}
            <Button type="submit" variant="secondary" className="w-full">Abrir fechas</Button>
          </div>
        </form>

        <div className="k-card p-5 sm:p-6 lg:col-span-2">
          <h2 className="k-section-title">
            Bloqueos de {MESES[cal.month - 1]} {cal.year}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo los que tocan este mes. Un bloqueo que empieza más adelante se ve
            cambiando de mes con las flechas de arriba.
          </p>
          {cal.bloqueos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No hay bloqueos en {MESES[cal.month - 1]}.
            </p>
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

      {/* Crear / editar reserva desde una celda del calendario */}
      <ReservationModal
        open={modal !== null}
        onClose={() => setModal(null)}
        tipos={tipos}
        cuartos={cal.rooms}
        reserva={modal?.reserva ?? null}
        defaults={modal?.defaults ?? null}
        onSaved={() => {
          setModal(null);
          cargar(cal.year, cal.month); // repinta el calendario
          router.refresh(); // y refresca la lista de reservas del servidor
        }}
      />
    </div>
  );
}
