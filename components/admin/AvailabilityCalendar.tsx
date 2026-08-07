"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  RefreshCw,
  Loader2,
  X,
  CalendarCheck,
  Plus,
} from "lucide-react";
import type { CalendarData } from "@/lib/booking/engine";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DOW = ["D", "L", "M", "M", "J", "V", "S"];
const MES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtDia(iso: string) {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${MES_CORTO[parseInt(m, 10) - 1]}`;
}
function sumarDia(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}
function mxn(n: number) {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

type Estado = "libre" | "reservada" | "bloqueada" | "ota";

// Paleta de estados, tal cual el calendario de Paraíso Encantado.
const TONO: Record<Estado, { bg: string; fg: string; punto: string; texto: string }> = {
  libre:     { bg: "#EAF3DE", fg: "#27500A", punto: "#3B6D11", texto: "Disponible" },
  reservada: { bg: "#FCEBEB", fg: "#791F1F", punto: "#A32D2D", texto: "Ocupada" },
  bloqueada: { bg: "#FAEEDA", fg: "#633806", punto: "#7a5a00", texto: "Bloqueada" },
  ota:       { bg: "#F1E9FA", fg: "#5B2C91", punto: "#7C3AED", texto: "Ocupada en OTA" },
};

export interface DiaClicado {
  roomId: string;
  numero: string;
  tipo: string;
  fecha: string;
  estado: Estado;
}

interface Props {
  cal: CalendarData;
  hoy: string;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onHoy: () => void;
  onRefresh: () => void;
  /** Abre el modal de nueva reserva con el cuarto y la fecha ya puestos. */
  onNuevaReserva: (d: DiaClicado) => void;
  /** Abre el modal de edición de la reserva que ocupa ese día. */
  onEditarReserva: (bookingId: string) => void;
}

export function AvailabilityCalendar({
  cal,
  hoy,
  loading,
  onPrev,
  onNext,
  onHoy,
  onRefresh,
  onNuevaReserva,
  onEditarReserva,
}: Props) {
  const [clic, setClic] = useState<DiaClicado | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Un día está "en OTA" cuando lo cierra un bloqueo importado del canal: esos
  // no se pueden soltar desde aquí, los repone la sincronización.
  const bloqueoDe = useMemo(() => {
    return (roomId: string, dia: string) =>
      cal.bloqueos.find(
        (b) => b.roomId === roomId && dia >= b.checkin && dia < b.checkout,
      );
  }, [cal.bloqueos]);

  const reservaDe = useMemo(() => {
    return (roomId: string, dia: string) =>
      cal.reservas.find(
        (r) => r.roomId === roomId && dia >= r.checkin && dia < r.checkout,
      );
  }, [cal.reservas]);

  function estadoDe(roomId: string, dia: string): Estado {
    const base = cal.grid[roomId]?.[dia] ?? "libre";
    if (base === "reservada") return "reservada";
    if (base === "bloqueada") {
      return bloqueoDe(roomId, dia)?.motivo === "ota" ? "ota" : "bloqueada";
    }
    return "libre";
  }

  function librosDe(roomId: string) {
    return cal.days.filter((d) => estadoDe(roomId, d) === "libre").length;
  }

  async function bloquear() {
    if (!clic) return;
    setGuardando(true);
    setError("");
    const res = await fetch("/api/admin/bloqueos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: clic.roomId,
        checkin: clic.fecha,
        checkout: sumarDia(clic.fecha),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(false);
    if (res.ok && data.ok) {
      setClic(null);
      onRefresh();
    } else {
      setError(data.error ?? "No se pudo bloquear la fecha.");
    }
  }

  async function desbloquear() {
    if (!clic) return;
    setGuardando(true);
    setError("");
    const res = await fetch("/api/admin/bloqueos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: clic.roomId, fecha: clic.fecha }),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(false);
    if (res.ok && data.ok) {
      setClic(null);
      onRefresh();
    } else {
      setError(data.error ?? "No se pudo desbloquear la fecha.");
    }
  }

  const primerDow = new Date(
    Date.UTC(cal.year, cal.month - 1, 1),
  ).getUTCDay();

  const reservaClic = clic ? reservaDe(clic.roomId, clic.fecha) : undefined;
  const bloqueoClic = clic ? bloqueoDe(clic.roomId, clic.fecha) : undefined;

  return (
    <div>
      {/* Barra: mes, hoy, leyenda, refrescar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={onPrev} aria-label="Mes anterior" className="k-navbtn">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[150px] text-center text-sm font-semibold text-[var(--k-forest)]">
            {loading ? "…" : `${MESES[cal.month - 1]} ${cal.year}`}
          </span>
          <button onClick={onNext} aria-label="Mes siguiente" className="k-navbtn">
            <ChevronRight className="size-4" />
          </button>
          <button onClick={onHoy} className="k-navbtn px-3 text-xs font-medium">
            Hoy
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {(["libre", "reservada", "bloqueada", "ota"] as Estado[]).map((e) => (
              <span
                key={e}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <i
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: TONO[e].punto }}
                />
                {e === "libre" ? "Libre" : TONO[e].texto}
              </span>
            ))}
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Actualizar"
            aria-label="Actualizar"
            className="k-navbtn"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Rejilla de mini-calendarios: uno por cuarto */}
      <div className="k-cal-grid mt-4">
        {cal.rooms.map((room) => {
          const libres = librosDe(room.id);
          return (
            <div key={room.id} className="bg-[#f9fafb] px-3.5 pt-3.5 pb-2.5">
              <div className="mb-2 truncate text-xs font-semibold tracking-wide text-[#1a1a1a]">
                {room.numero}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {room.tipo}
                </span>
              </div>

              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {DOW.map((d, i) => (
                  <div
                    key={i}
                    className="py-px text-center text-[9px] font-medium text-[#9ca3af]"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: primerDow }).map((_, i) => (
                  <div key={`h${i}`} className="aspect-square" />
                ))}
                {cal.days.map((dia) => {
                  const n = parseInt(dia.slice(-2), 10);
                  const pasado = dia < hoy;
                  const esHoy = dia === hoy;
                  const estado = estadoDe(room.id, dia);
                  const tono = TONO[estado];
                  return (
                    <button
                      key={dia}
                      type="button"
                      disabled={pasado}
                      onClick={() => {
                        setError("");
                        setClic({
                          roomId: room.id,
                          numero: room.numero,
                          tipo: room.tipo,
                          fecha: dia,
                          estado,
                        });
                      }}
                      title={`${room.numero} · ${dia} · ${tono.texto}`}
                      className={`flex aspect-square items-center justify-center rounded-[4px] text-[11px] transition-opacity ${
                        pasado
                          ? "cursor-default opacity-30"
                          : "cursor-pointer hover-hover:hover:opacity-75"
                      }`}
                      style={{
                        background: pasado ? "transparent" : tono.bg,
                        color: pasado ? "#ccc" : tono.fg,
                        fontWeight: esHoy ? 700 : 400,
                        outline: esHoy ? "2px solid #2d7a34" : undefined,
                        outlineOffset: esHoy ? -1 : undefined,
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[11px]">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-[#3B6D11]">{libres}</span> libres
                </span>
                {room.tarifa > 0 && (
                  <span className="text-[#9ca3af]">{mxn(room.tarifa)}/n</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ficha del día */}
      {clic && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setClic(null);
              setError("");
            }
          }}
        >
          <div className="max-h-[85dvh] w-[min(92vw,340px)] overflow-y-auto rounded-lg bg-card shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <span className="text-sm font-semibold text-foreground">
                {clic.estado === "libre" ? "Fecha disponible" : `Fecha ${TONO[clic.estado].texto.toLowerCase()}`}
              </span>
              <button
                onClick={() => {
                  setClic(null);
                  setError("");
                }}
                aria-label="Cerrar"
                className="text-[#9ca3af] hover-hover:hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-4">
              <span
                className="mb-2.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={{ background: TONO[clic.estado].bg, color: TONO[clic.estado].fg }}
              >
                ● {TONO[clic.estado].texto}
              </span>

              <div className="text-base font-semibold text-foreground">
                Cuarto {clic.numero}
              </div>
              <div className="mb-3.5 text-[13px] text-muted-foreground">
                {clic.tipo} · {fmtDia(clic.fecha)}, {cal.year}
              </div>

              {clic.estado === "reservada" && reservaClic && (
                <div className="mb-3.5 rounded-md bg-background p-3">
                  {[
                    ["Huésped", reservaClic.nombre],
                    ["Llegada", reservaClic.checkin],
                    ["Salida", reservaClic.checkout],
                    ["Noches", String(reservaClic.noches)],
                    ["Huéspedes", String(reservaClic.huespedes)],
                    ["Total", `${mxn(reservaClic.total)} MXN`],
                    ["Folio", reservaClic.ref],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between gap-3 py-0.5 text-xs">
                      <span className="text-[#9ca3af]">{label}</span>
                      <span className="font-medium text-foreground">{val}</span>
                    </div>
                  ))}
                </div>
              )}

              {clic.estado === "reservada" && !reservaClic && (
                <div className="mb-3.5 rounded-md bg-[#fde8e8] p-3 text-xs leading-relaxed text-[#791F1F]">
                  La fecha está ocupada pero no se encontró la reserva en el panel.
                  Puede ser un hold de pago a punto de vencer. Recarga en un minuto.
                </div>
              )}

              {clic.estado === "bloqueada" && (
                <div className="mb-3.5 border-l-[3px] border-[#52b788] bg-[#fff8ee] px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  Fecha bloqueada a mano. Al desbloquearla vuelve a venderse en el sitio.
                  {bloqueoClic && bloqueoClic.checkin !== clic.fecha && (
                    <>
                      <br />
                      <br />
                      Forma parte del bloqueo del {bloqueoClic.checkin} al{" "}
                      {bloqueoClic.checkout}. Solo se libera este día; el resto sigue
                      cerrado.
                    </>
                  )}
                  {bloqueoClic?.nota ? (
                    <>
                      <br />
                      <br />
                      Nota: {bloqueoClic.nota}
                    </>
                  ) : null}
                </div>
              )}

              {clic.estado === "ota" && (
                <div className="mb-3.5 border-l-[3px] border-[#7C3AED] bg-[#F1E9FA] px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  Fecha cerrada por un canal
                  {bloqueoClic?.origen ? ` (${bloqueoClic.origen})` : ""}, importada de su
                  calendario. <strong>No se libera desde aquí:</strong> la
                  sincronización volvería a cerrarla. Cancélala en la extranet del canal.
                </div>
              )}

              {error && (
                <div className="mb-3 rounded bg-[#fde8e8] px-3 py-2 text-xs text-[#8a1a1a]">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {clic.estado === "libre" && (
                  <>
                    <button
                      onClick={() => {
                        onNuevaReserva(clic);
                        setClic(null);
                      }}
                      className="flex items-center justify-center gap-2 rounded-md bg-[var(--k-forest)] px-3 py-2.5 text-[13px] font-semibold text-white btn-press"
                    >
                      <Plus className="size-3.5" /> Nueva reserva
                    </button>
                    <button
                      onClick={bloquear}
                      disabled={guardando}
                      className="flex items-center justify-center gap-2 rounded-md bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-white disabled:opacity-60 btn-press"
                    >
                      {guardando ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Lock className="size-3.5" />
                      )}
                      Bloquear esta fecha
                    </button>
                  </>
                )}

                {clic.estado === "bloqueada" && (
                  <button
                    onClick={desbloquear}
                    disabled={guardando}
                    className="flex items-center justify-center gap-2 rounded-md bg-[#3d6e40] px-3 py-2.5 text-[13px] text-white disabled:opacity-60 btn-press"
                  >
                    {guardando ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Unlock className="size-3.5" />
                    )}
                    Desbloquear esta fecha
                  </button>
                )}

                {clic.estado === "reservada" && reservaClic && (
                  <button
                    onClick={() => {
                      onEditarReserva(reservaClic.id);
                      setClic(null);
                    }}
                    className="flex items-center justify-center gap-2 rounded-md bg-[#2e6b8a] px-3 py-2.5 text-[13px] text-white btn-press"
                  >
                    <CalendarCheck className="size-3.5" /> Ver / editar reserva
                  </button>
                )}

                <button
                  onClick={() => {
                    setClic(null);
                    setError("");
                  }}
                  className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover-hover:hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
