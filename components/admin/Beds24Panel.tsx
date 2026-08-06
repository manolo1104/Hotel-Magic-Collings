"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, RefreshCw, TriangleAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EstadoBeds24 } from "@/lib/beds24/sync";
import type { Beds24Room } from "@/lib/beds24/client";

function fmtFecha(v: string | null): string {
  if (!v) return "nunca";
  try {
    return new Date(v).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export function Beds24Panel({
  estado,
  habitaciones,
  errorConexion,
}: {
  estado: EstadoBeds24;
  habitaciones: Beds24Room[];
  errorConexion: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function emparejar(roomTypeId: string, beds24RoomId: string) {
    setBusy(roomTypeId);
    setError(null);
    const res = await fetch("/api/admin/beds24", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "emparejar",
        roomTypeId,
        beds24RoomId: beds24RoomId ? Number(beds24RoomId) : null,
      }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok || !data.ok) setError(data.error ?? "No se pudo guardar.");
    else router.refresh();
  }

  async function sincronizar() {
    setBusy("sync");
    setAviso(null);
    setError(null);
    const res = await fetch("/api/admin/beds24", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "sincronizar" }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok || !data.ok) {
      setError(data.error ?? "No se pudo sincronizar.");
      return;
    }
    setAviso(
      data.omitido
        ? "Ya había una sincronización en curso; se omitió esta."
        : `Listo: ${data.importadas} reserva(s) traída(s) de Booking, ${data.subidas} subida(s), ${data.canceladas} cancelada(s)${data.errores ? `, ${data.errores} con error` : ""}.`,
    );
    router.refresh();
  }

  const sinEmparejar = estado.emparejamientos.filter((e) => e.beds24RoomId == null).length;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Link2 className="size-4 text-brand" /> Booking.com (channel manager)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sincronización en las dos direcciones a través de Beds24: lo que se
            vende aquí se cierra en Booking, y lo que se vende en Booking se
            cierra aquí.
          </p>
        </div>
        {estado.activo && (
          <Button onClick={sincronizar} disabled={busy === "sync"} className="gap-2">
            {busy === "sync" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sincronizar ahora
          </Button>
        )}
      </header>

      {!estado.activo ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm">
          <p className="font-medium">Todavía no está conectado.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Crear la cuenta en beds24.com y conectar Booking.com desde ahí.</li>
            <li>
              Generar un código de invitación en{" "}
              <code className="text-xs">beds24.com/control3.php?pagetype=apiv2</code> con los
              permisos <strong>bookings</strong>, <strong>inventory</strong> y{" "}
              <strong>properties</strong>.
            </li>
            <li>
              Canjearlo por el token permanente:{" "}
              <code className="text-xs">npm run beds24:conectar &lt;código&gt;</code>
            </li>
            <li>
              Guardar ese token en Railway como <code className="text-xs">BEDS24_REFRESH_TOKEN</code>.
            </li>
          </ol>
        </div>
      ) : (
        <>
          {errorConexion && (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              No se pudo hablar con Beds24: {errorConexion}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Última revisión</dt>
              <dd className="mt-0.5 text-sm font-medium">{fmtFecha(estado.ultimaSync)}</dd>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Traídas de OTAs</dt>
              <dd className="mt-0.5 text-sm font-medium">{estado.importadas}</dd>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Por subir</dt>
              <dd className="mt-0.5 text-sm font-medium">{estado.pendientesDeSubir}</dd>
            </div>
            <div
              className={`rounded-xl p-3 ${estado.conError ? "bg-destructive/10" : "bg-muted/60"}`}
            >
              <dt className="text-xs text-muted-foreground">Con error</dt>
              <dd className="mt-0.5 text-sm font-medium">{estado.conError}</dd>
            </div>
          </dl>

          {sinEmparejar > 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-4 py-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
              Faltan {sinEmparejar} tipo(s) de habitación por emparejar. Mientras no lo
              estén, esas habitaciones <strong>no</strong> se sincronizan con Booking.
            </p>
          )}
        </>
      )}

      {/* Emparejamiento tipo ↔ habitación de Beds24 */}
      <div className="mt-5">
        <h3 className="text-sm font-medium">Emparejar habitaciones</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada tipo de habitación del sitio debe apuntar a su equivalente en Beds24.
          Comprueba que el número de unidades coincida en los dos lados.
        </p>
        <div className="mt-3 grid gap-2">
          {estado.emparejamientos.map((e) => (
            <div
              key={e.roomTypeId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {e.beds24RoomId != null && (
                    <CheckCircle2 className="size-4 shrink-0 text-brand" />
                  )}
                  {e.nombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.unidades} unidad(es) en el sitio
                </p>
              </div>
              <select
                aria-label={`Habitación de Beds24 para ${e.nombre}`}
                disabled={!estado.activo || busy === e.roomTypeId}
                value={e.beds24RoomId ?? ""}
                onChange={(ev) => emparejar(e.roomTypeId, ev.target.value)}
                className="h-9 min-w-[220px] rounded-lg border border-input bg-transparent px-3 text-sm disabled:opacity-50"
              >
                <option value="">Sin emparejar</option>
                {/* La habitación ya guardada se muestra aunque la lista de
                    Beds24 no haya cargado, para no perder el dato de vista. */}
                {e.beds24RoomId != null &&
                  !habitaciones.some((h) => h.id === e.beds24RoomId) && (
                    <option value={e.beds24RoomId}>#{e.beds24RoomId}</option>
                  )}
                {habitaciones.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} · {h.qty} unidad(es)
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {aviso && <p className="mt-4 rounded-lg bg-muted px-4 py-2 text-sm">{aviso}</p>}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </section>
  );
}
