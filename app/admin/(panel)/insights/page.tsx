import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LogIn, LogOut, BedDouble, CalendarDays } from "lucide-react";
import { listBookings, countActiveRooms } from "@/lib/booking/engine";
import { calcInsights } from "@/lib/admin/insights";
import { calcKPIs } from "@/lib/admin/kpis";

export const metadata: Metadata = { title: "Insights", robots: { index: false } };
export const dynamic = "force-dynamic";

function mxn(n: number) {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}
function fmt(iso: string) {
  try {
    return format(new Date(`${iso}T12:00:00`), "EEE d MMM", { locale: es });
  } catch {
    return iso;
  }
}

export default async function InsightsPage() {
  const [reservas, totalRooms] = await Promise.all([
    listBookings(),
    countActiveRooms(),
  ]);
  const hoy = new Date();
  const d = calcInsights(reservas, totalRooms, hoy);
  // Desglose por tipo (este año), ordenado por nº de reservas para destacar
  // la habitación más vendida y qué % representa cada una.
  const k = calcKPIs(reservas, totalRooms, hoy);
  const porTipo = [...k.porTipo].sort((a, b) => b.reservas - a.reservas);
  const totalReservasTipo = porTipo.reduce((s, t) => s + t.reservas, 0);
  const masVendida = porTipo[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-6 pb-20 sm:px-6 lg:pt-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de hoy y pronóstico de la semana
        </p>
      </header>

      {/* Tarjetas del día */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Ocupación hoy" value={`${d.ocupadosHoy}/${d.totalRooms}`} sub={`${d.ocupacionHoyPct}%`} tone="brand" />
        <Card label="Llegan hoy" value={String(d.checkins.length)} sub="check-in" tone="support" />
        <Card label="Salen hoy" value={String(d.checkouts.length)} sub="check-out" tone="amber" />
        <Card label="En casa" value={String(d.enCasa)} sub="huéspedes activos" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Ingreso del mes" value={mxn(d.ingresoMes)} sub={`${d.reservasMes} reservas`} />
      </div>

      {/* Pronóstico 7 días */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <CalendarDays className="size-4 text-brand" /> Pronóstico de ocupación
        </h2>
        <div className="mt-5 flex items-end justify-between gap-2" style={{ height: 130 }}>
          {d.forecast.map((f) => (
            <div key={f.fecha} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-medium text-muted-foreground">{f.pct}%</span>
              <div
                className="w-full max-w-[36px] rounded-t-md bg-brand"
                style={{ height: `${Math.max(4, (f.pct / 100) * 90)}px` }}
                title={`${f.ocupados}/${d.totalRooms}`}
              />
              <span className="text-[11px] text-muted-foreground">{f.etiqueta}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Habitación más vendida + desglose por tipo (este año) */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <BedDouble className="size-4 text-brand" /> Habitación más vendida
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Este año
          </span>
        </h2>
        {totalReservasTipo === 0 || !masVendida ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Aún no hay reservas este año.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {masVendida.nombre}
              </span>{" "}
              es la más reservada: {masVendida.reservas} de {totalReservasTipo}{" "}
              reservas (
              {Math.round((masVendida.reservas / totalReservasTipo) * 100)}%).
            </p>
            <div className="mt-4 space-y-3">
              {porTipo.map((t) => (
                <Barra
                  key={t.nombre}
                  label={t.nombre}
                  sub={`${t.reservas} ${
                    t.reservas === 1 ? "reserva" : "reservas"
                  } · ${mxn(t.ingreso)}`}
                  valor={`${Math.round((t.reservas / totalReservasTipo) * 100)}%`}
                  pct={(t.reservas / totalReservasTipo) * 100}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Movimientos de hoy */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Lista
          titulo="Llegadas de hoy"
          icon={<LogIn className="size-4 text-support" />}
          vacio="Nadie llega hoy."
          items={d.checkins.map((c) => ({
            principal: c.nombre,
            secundario: `${c.tipo} · cuarto ${c.numero} · ${c.huespedes} huésp.`,
          }))}
        />
        <Lista
          titulo="Salidas de hoy"
          icon={<LogOut className="size-4 text-amber-600" />}
          vacio="Nadie sale hoy."
          items={d.checkouts.map((c) => ({
            principal: c.nombre,
            secundario: `${c.tipo} · cuarto ${c.numero}`,
          }))}
        />
      </div>

      {/* Próximas llegadas */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <BedDouble className="size-4 text-brand" /> Próximas llegadas
        </h2>
        {d.proximasLlegadas.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No hay reservas futuras.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {d.proximasLlegadas.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="font-medium">{p.nombre}</span>
                <span className="text-muted-foreground">
                  {p.tipo} · {fmt(p.checkin)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/admin"
          className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver todas las reservas →
        </Link>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "brand" | "support" | "amber";
}) {
  const valueCls =
    tone === "brand"
      ? "text-brand"
      : tone === "support"
        ? "text-support"
        : tone === "amber"
          ? "text-amber-600"
          : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-heading text-2xl font-semibold ${valueCls}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Barra({
  label,
  sub,
  valor,
  pct,
}: {
  label: string;
  sub: string;
  valor: string;
  pct: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{valor}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Lista({
  titulo,
  icon,
  vacio,
  items,
}: {
  titulo: string;
  icon: React.ReactNode;
  vacio: string;
  items: { principal: string; secundario: string }[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
        {icon} {titulo}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {items.map((it, i) => (
            <li key={i} className="py-2">
              <div className="text-sm font-medium">{it.principal}</div>
              <div className="text-xs text-muted-foreground">{it.secundario}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
