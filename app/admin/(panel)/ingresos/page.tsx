import type { Metadata } from "next";
import { listBookings, countActiveRooms } from "@/lib/booking/engine";
import { calcKPIs } from "@/lib/admin/kpis";
import { AreaChart } from "@/components/admin/charts/AreaChart";

export const metadata: Metadata = { title: "Ingresos", robots: { index: false } };
export const dynamic = "force-dynamic";

function mxn(n: number) {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

export default async function IngresosPage() {
  const [reservas, totalRooms] = await Promise.all([
    listBookings(),
    countActiveRooms(),
  ]);
  const k = calcKPIs(reservas, totalRooms, new Date());

  const maxTipo = Math.max(1, ...k.porTipo.map((t) => t.ingreso));
  const maxOrigen = Math.max(1, ...k.porOrigen.map((o) => o.ingreso));
  const maxConociste = Math.max(1, ...k.porNosConociste.map((c) => c.ingreso));
  const origenLabel: Record<string, string> = {
    web: "Sitio web",
    whatsapp: "WhatsApp",
    manual: "Manual",
    booking: "Booking",
    expedia: "Expedia",
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-6 pb-20 sm:px-6 lg:pt-8">
      <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Ingresos</h1>
      <p className="text-sm text-muted-foreground">
        Mes en curso y tendencia de los últimos 12 meses
      </p>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label="Ingreso del mes"
          value={mxn(k.ingresoMes)}
          extra={
            k.deltaIngresoPct == null
              ? undefined
              : `${k.deltaIngresoPct >= 0 ? "▲" : "▼"} ${Math.abs(k.deltaIngresoPct)}% vs mes anterior`
          }
          extraTone={k.deltaIngresoPct != null && k.deltaIngresoPct >= 0 ? "up" : "down"}
        />
        <Card label="Ocupación" value={`${k.ocupacionMes}%`} extra={`${k.reservasMes} reservas`} />
        <Card label="Tarifa media (ADR)" value={mxn(k.adr)} extra="por noche" />
        <Card label="RevPAR" value={mxn(k.revpar)} extra="por cuarto disponible" />
      </div>

      {/* Tendencia */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Tendencia de ingresos</h2>
        <p className="text-xs text-muted-foreground">Últimos 12 meses (por mes de llegada)</p>
        <div className="mt-4">
          <AreaChart data={k.serie.map((s) => ({ etiqueta: s.etiqueta, valor: s.ingreso }))} />
        </div>
      </section>

      {/* Breakdowns */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">Por tipo de habitación</h2>
          <p className="text-xs text-muted-foreground">Este año</p>
          <div className="mt-4 space-y-3">
            {k.porTipo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos.</p>
            ) : (
              k.porTipo.map((t) => (
                <Barra key={t.nombre} label={t.nombre} sub={`${t.reservas} reservas`} valor={mxn(t.ingreso)} pct={(t.ingreso / maxTipo) * 100} />
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">Por origen</h2>
          <p className="text-xs text-muted-foreground">Este año</p>
          <div className="mt-4 space-y-3">
            {k.porOrigen.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos.</p>
            ) : (
              k.porOrigen.map((o) => (
                <Barra key={o.origen} label={origenLabel[o.origen] ?? o.origen} sub={`${o.reservas} reservas`} valor={mxn(o.ingreso)} pct={(o.ingreso / maxOrigen) * 100} />
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">¿De dónde nos conocen?</h2>
          <p className="text-xs text-muted-foreground">
            Este año · lo que respondió el huésped al reservar
          </p>
          <div className="mt-4 space-y-3">
            {k.porNosConociste.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún sin respuestas. El dato se pide en el formulario de reserva.
              </p>
            ) : (
              k.porNosConociste.map((c) => (
                <Barra key={c.canal} label={c.canal} sub={`${c.reservas} reservas`} valor={mxn(c.ingreso)} pct={(c.ingreso / maxConociste) * 100} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  extra,
  extraTone,
}: {
  label: string;
  value: string;
  extra?: string;
  extraTone?: "up" | "down";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-heading text-xl font-semibold sm:text-2xl">{value}</div>
      {extra && (
        <div
          className={`mt-0.5 text-xs ${
            extraTone === "up" ? "text-support" : extraTone === "down" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {extra}
        </div>
      )}
    </div>
  );
}

function Barra({ label, sub, valor, pct }: { label: string; sub: string; valor: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{valor}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
