import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Users, MessageCircle, Mail, BedDouble } from "lucide-react";
import { sesionActiva, adminConfigurado } from "@/lib/admin/auth";
import { listBookings, type BookingView } from "@/lib/booking/engine";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const metadata: Metadata = { title: "Panel de reservas", robots: { index: false } };
export const dynamic = "force-dynamic";

type SP = Promise<{ f?: string | string[] }>;

function mxn(n: number | null): string {
  return `$${Math.round(n ?? 0).toLocaleString("es-MX")}`;
}
function fmt(iso: string): string {
  try {
    return format(new Date(`${iso}T12:00:00`), "d MMM yyyy", { locale: es });
  } catch {
    return iso;
  }
}
function fmtDateTime(d: Date | string | null): string {
  if (!d) return "—";
  try {
    return format(new Date(d), "d MMM, HH:mm", { locale: es });
  } catch {
    return "—";
  }
}

const FILTROS = [
  { key: "todas", label: "Todas" },
  { key: "pagado", label: "Pagadas" },
  { key: "esperando", label: "Esperando pago" },
  { key: "whatsapp", label: "Por WhatsApp" },
  { key: "canceladas", label: "Canceladas" },
];

function aplicaFiltro(b: BookingView, f: string): boolean {
  switch (f) {
    case "pagado":
      return b.estadoPago === "pagado";
    case "esperando":
      return b.estadoPago === "iniciado";
    case "whatsapp":
      return b.estadoPago === "no_iniciado" && b.estado !== "cancelada";
    case "canceladas":
      return b.estado === "cancelada" || b.estado === "expirada";
    default:
      return true;
  }
}

function badgePago(b: BookingView) {
  const map: Record<string, { txt: string; cls: string }> = {
    pagado: { txt: "Pagada", cls: "bg-support/15 text-support" },
    iniciado: { txt: "Esperando pago", cls: "bg-amber-500/15 text-amber-700" },
    no_iniciado: { txt: "Por WhatsApp", cls: "bg-muted text-muted-foreground" },
    rechazado: { txt: "Pago rechazado", cls: "bg-destructive/10 text-destructive" },
    reembolsado: { txt: "Reembolsada", cls: "bg-destructive/10 text-destructive" },
    expirado: { txt: "Expirada", cls: "bg-muted text-muted-foreground" },
  };
  const it = map[b.estadoPago] ?? map.no_iniciado;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${it.cls}`}>
      {it.txt}
    </span>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: SP }) {
  if (!adminConfigurado()) {
    return (
      <div className="mx-auto max-w-md px-4 py-28 text-center">
        <h1 className="font-heading text-2xl font-semibold">Panel no configurado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Falta definir <code>ADMIN_PASSWORD</code> y{" "}
          <code>ADMIN_SESSION_SECRET</code> en las variables de entorno.
        </p>
      </div>
    );
  }
  if (!(await sesionActiva())) redirect("/admin/login");

  const sp = await searchParams;
  const f = (Array.isArray(sp.f) ? sp.f[0] : sp.f) || "todas";

  const todas = await listBookings();
  const reservas = todas.filter((b) => aplicaFiltro(b, f));

  const pagadas = todas.filter((b) => b.estadoPago === "pagado");
  const ingreso = pagadas.reduce((s, b) => s + (b.montoPagado ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-24 pb-20 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
            Reservas
          </h1>
          <p className="text-sm text-muted-foreground">Hotel Magic Collinn</p>
        </div>
        <LogoutButton />
      </header>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Reservas" value={String(todas.length)} />
        <Stat label="Pagadas" value={String(pagadas.length)} />
        <Stat label="Ingreso en línea" value={mxn(ingreso)} />
      </div>

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTROS.map((it) => (
          <Link
            key={it.key}
            href={it.key === "todas" ? "/admin" : `/admin?f=${it.key}`}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              f === it.key
                ? "bg-brand text-brand-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {it.label}
          </Link>
        ))}
      </div>

      {/* Lista */}
      {reservas.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No hay reservas en este filtro.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {reservas.map((b) => {
            const ref = b.id.slice(0, 8).toUpperCase();
            const saldo = b.saldoPendiente ?? Math.max(0, b.total - (b.montoPagado ?? 0));
            const wa = b.whatsapp.replace(/[^0-9]/g, "");
            return (
              <article
                key={b.id}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-lg font-semibold">{b.nombre}</h2>
                      {badgePago(b)}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Reserva {ref} · creada {fmtDateTime(b.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-heading text-lg font-semibold text-primary">
                      {mxn(b.total)} <span className="text-xs text-muted-foreground">MXN</span>
                    </div>
                    {b.montoPagado > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Pagado {mxn(b.montoPagado)}
                        {saldo > 0 ? ` · saldo ${mxn(saldo)}` : ""}
                      </div>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                  <Campo icon={<BedDouble className="size-4" />} label="Habitación">
                    {b.nombreTipo} · {b.numeroCuarto}
                  </Campo>
                  <Campo label="Llegada">{fmt(b.checkin)}</Campo>
                  <Campo label="Salida">{fmt(b.checkout)}</Campo>
                  <Campo icon={<Users className="size-4" />} label="Huéspedes">
                    {b.huespedes}
                  </Campo>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4 text-sm">
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 font-medium text-foreground hover:bg-secondary"
                  >
                    <MessageCircle className="size-4 text-support" aria-hidden />
                    {b.whatsapp}
                  </a>
                  {b.email && (
                    <a
                      href={`mailto:${b.email}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 font-medium text-foreground hover:bg-secondary"
                    >
                      <Mail className="size-4 text-brand" aria-hidden />
                      {b.email}
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-heading text-xl font-semibold sm:text-2xl">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Campo({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
