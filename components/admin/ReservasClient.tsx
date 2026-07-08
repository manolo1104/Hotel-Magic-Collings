"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus,
  Search,
  Sun,
  Pencil,
  Printer,
  MessageCircle,
  Mail,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReservationModal, type TipoOpcion } from "./ReservationModal";
import type { BookingView } from "@/lib/booking/engine";

function mxn(n: number | null) {
  return `$${Math.round(n ?? 0).toLocaleString("es-MX")}`;
}
function fmt(iso: string) {
  try {
    return format(new Date(`${iso}T12:00:00`), "d MMM", { locale: es });
  } catch {
    return iso;
  }
}

type OpsKey = "LLEGA_HOY" | "EN_CASA" | "SALE_HOY" | "PROXIMA" | "COMPLETADA" | "CANCELADA";

function opsState(b: BookingView, today: string): { key: OpsKey; label: string; cls: string } {
  if (b.estado === "cancelada" || b.estado === "expirada")
    return { key: "CANCELADA", label: "Cancelada", cls: "bg-destructive/10 text-destructive" };
  if (b.checkin === today)
    return { key: "LLEGA_HOY", label: "Llega hoy", cls: "bg-support/15 text-support" };
  if (b.checkout === today)
    return { key: "SALE_HOY", label: "Sale hoy", cls: "bg-amber-500/15 text-amber-700" };
  if (b.checkin < today && b.checkout > today)
    return { key: "EN_CASA", label: "En casa", cls: "bg-brand/10 text-brand" };
  if (b.checkin > today)
    return { key: "PROXIMA", label: "Próxima", cls: "bg-muted text-muted-foreground" };
  return { key: "COMPLETADA", label: "Completada", cls: "bg-muted text-muted-foreground" };
}

function badgePago(b: BookingView) {
  const map: Record<string, { t: string; c: string }> = {
    pagado: { t: "Pagada", c: "bg-support/15 text-support" },
    parcial: { t: "Anticipo", c: "bg-amber-500/15 text-amber-700" },
    iniciado: { t: "Esperando pago", c: "bg-amber-500/15 text-amber-700" },
    no_iniciado: { t: "Sin pago en línea", c: "bg-muted text-muted-foreground" },
    rechazado: { t: "Pago rechazado", c: "bg-destructive/10 text-destructive" },
  };
  const it = map[b.estadoPago] ?? map.no_iniciado;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${it.c}`}>{it.t}</span>;
}

export function ReservasClient({
  initial,
  tipos,
  today,
}: {
  initial: BookingView[];
  tipos: TipoOpcion[];
  today: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [filtroOps, setFiltroOps] = useState("");
  const [soloHoy, setSoloHoy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<BookingView | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const lista = useMemo(() => {
    return initial.filter((b) => {
      const ops = opsState(b, today);
      if (soloHoy && !["LLEGA_HOY", "EN_CASA", "SALE_HOY"].includes(ops.key)) return false;
      if (filtroOps && ops.key !== filtroOps) return false;
      if (tipo && b.nombreTipo !== tipo) return false;
      if (q) {
        const hay = `${b.nombre} ${b.whatsapp} ${b.email ?? ""} ${b.id.slice(0, 8)}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [initial, today, soloHoy, filtroOps, tipo, q]);

  const pagadas = initial.filter((b) => b.estadoPago === "pagado").length;
  const ingreso = initial.reduce((s, b) => s + (b.montoPagado ?? 0), 0);

  async function cancelar(b: BookingView) {
    if (!confirm(`¿Cancelar la reserva de ${b.nombre}? El cuarto quedará libre.`)) return;
    const res = await fetch(`/api/admin/reservas/${b.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setAviso("No se pudo cancelar.");
  }
  async function reenviar(b: BookingView) {
    setAviso(null);
    const res = await fetch(`/api/admin/reservas/${b.id}/send-email`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setAviso(res.ok ? "Correo enviado." : data.error ?? "No se pudo enviar el correo.");
  }

  const tiposNombres = Array.from(new Set(initial.map((b) => b.nombreTipo)));

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-6 pb-20 sm:px-6 lg:pt-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Reservas</h1>
          <p className="text-sm text-muted-foreground">
            {initial.length} reservas · {pagadas} pagadas · {mxn(ingreso)} cobrado en línea
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setEditando(null);
            setModalOpen(true);
          }}
        >
          <Plus className="size-4" /> Nueva reserva
        </Button>
      </header>

      {/* Controles */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar huésped, teléfono, correo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
        >
          <option value="">Toda habitación</option>
          {tiposNombres.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filtroOps}
          onChange={(e) => setFiltroOps(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
        >
          <option value="">Todo estado</option>
          <option value="LLEGA_HOY">Llega hoy</option>
          <option value="EN_CASA">En casa</option>
          <option value="SALE_HOY">Sale hoy</option>
          <option value="PROXIMA">Próximas</option>
          <option value="COMPLETADA">Completadas</option>
          <option value="CANCELADA">Canceladas</option>
        </select>
        <Button
          variant={soloHoy ? "default" : "secondary"}
          className="gap-1.5"
          onClick={() => setSoloHoy((v) => !v)}
        >
          <Sun className="size-4" /> Hoy
        </Button>
      </div>

      {aviso && (
        <p className="mt-4 rounded-lg bg-muted px-4 py-2 text-sm text-foreground">{aviso}</p>
      )}

      {/* Lista */}
      {lista.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No hay reservas en este filtro.
        </p>
      ) : (
        <div className="mt-5 grid gap-3">
          {lista.map((b) => {
            const ops = opsState(b, today);
            const saldo = b.saldoPendiente ?? Math.max(0, b.total - (b.montoPagado ?? 0));
            const wa = b.whatsapp.replace(/[^0-9]/g, "");
            return (
              <article key={b.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{b.nombre}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ops.cls}`}>
                        {ops.label}
                      </span>
                      {badgePago(b)}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {b.nombreTipo} · {b.numeroCuarto} · {fmt(b.checkin)} → {fmt(b.checkout)} · {b.huespedes} huésp. · {b.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold text-primary">{mxn(b.total)}</div>
                    {saldo > 0 && (
                      <div className="text-xs text-muted-foreground">saldo {mxn(saldo)}</div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                  <IconBtn onClick={() => { setEditando(b); setModalOpen(true); }} icon={<Pencil className="size-4" />} label="Editar" />
                  <IconBtn onClick={() => window.open(`/api/admin/reservas/${b.id}/render?print=1`, "_blank")} icon={<Printer className="size-4" />} label="PDF" />
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
                  >
                    <MessageCircle className="size-4 text-support" /> WhatsApp
                  </a>
                  {b.email && (
                    <IconBtn onClick={() => reenviar(b)} icon={<Mail className="size-4 text-brand" />} label="Correo" />
                  )}
                  {b.estado !== "cancelada" && (
                    <IconBtn onClick={() => cancelar(b)} icon={<XCircle className="size-4 text-destructive" />} label="Cancelar" />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ReservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tipos={tipos}
        reserva={editando}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function IconBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
    >
      {icon} {label}
    </button>
  );
}
