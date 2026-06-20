// ============================================================
// RESULTADO DE RESERVA (server) — páginas de retorno de Mercado Pago.
// El mensaje se decide por el ESTADO REAL en la BD (no por la URL), para
// manejar la carrera "el huésped vuelve antes de que llegue el webhook".
// ============================================================
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  XCircle,
  MessageCircle,
  CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { site, waLink } from "@/lib/site";
import { bookingIcs } from "@/lib/ics";
import type { BookingView } from "@/lib/booking/engine";

type Variante = "exito" | "pendiente" | "error";

function mxn(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")} MXN`;
}
function fmt(iso: string): string {
  try {
    return format(new Date(`${iso}T12:00:00`), "EEE d 'de' MMM", { locale: es });
  } catch {
    return iso;
  }
}

export function ResultadoReserva({
  view,
  variante,
}: {
  view: BookingView | null;
  variante: Variante;
}) {
  if (!view) {
    return (
      <Shell
        icon={<Clock className="size-8" aria-hidden />}
        tone="muted"
        titulo="No encontramos tu reserva"
        texto="Si acabas de pagar, dale un momento y revisa tu correo o escríbenos por WhatsApp y te ayudamos."
      >
        <WhatsAppBtn msg="Hola, tengo una duda sobre mi reserva en Magic Collinn." />
      </Shell>
    );
  }

  const ref = view.id.slice(0, 8).toUpperCase();
  const saldo = view.saldoPendiente ?? Math.max(0, view.total - view.montoPagado);
  const recap = (
    <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-xl bg-secondary/50 p-4 text-left text-sm">
      <Row k="Reserva" v={ref} />
      <Row k="Habitación" v={view.nombreTipo} />
      <Row k="Llegada" v={fmt(view.checkin)} />
      <Row k="Salida" v={fmt(view.checkout)} />
      <Row k="Huéspedes" v={String(view.huespedes)} />
      <Row k="Total" v={mxn(view.total)} />
      {view.montoPagado > 0 && <Row k="Pagado en línea" v={mxn(view.montoPagado)} strong />}
      {saldo > 0 && <Row k="Saldo en el hotel" v={mxn(saldo)} />}
    </dl>
  );

  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(
    bookingIcs({ ref, checkin: view.checkin, checkout: view.checkout }),
  )}`;

  // PAGADA → éxito (gana sobre la variante de URL)
  if (view.estadoPago === "pagado") {
    return (
      <Shell
        icon={<CheckCircle2 className="size-8" aria-hidden />}
        tone="success"
        titulo="¡Reserva confirmada!"
        texto={
          saldo > 0
            ? `Recibimos tu anticipo. El saldo de ${mxn(saldo)} se paga en el hotel al llegar.`
            : "Tu estancia quedó pagada por completo. Te esperamos."
        }
      >
        {recap}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            className="h-11 gap-2 px-6"
            render={<a href={icsHref} download="reserva-magic-collinn.ics" />}
          >
            <CalendarPlus className="size-4" aria-hidden /> Agregar a tu calendario
          </Button>
          <WhatsAppBtn
            variant="secondary"
            msg={`Hola, soy ${view.nombre}. Mi reserva ${ref} en Magic Collinn está confirmada.`}
          />
        </div>
        <Inicio />
      </Shell>
    );
  }

  // RECHAZADA / CANCELADA → error
  if (
    view.estadoPago === "rechazado" ||
    view.estado === "cancelada" ||
    variante === "error"
  ) {
    return (
      <Shell
        icon={<XCircle className="size-8" aria-hidden />}
        tone="error"
        titulo="El pago no se completó"
        texto="No se realizó ningún cargo. Puedes intentar de nuevo o reservar y pagar en el hotel escribiéndonos por WhatsApp."
      >
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button className="h-11 px-6" render={<Link href="/buscar" />}>
            Volver a intentar
          </Button>
          <WhatsAppBtn
            variant="secondary"
            msg="Hola, quiero reservar en Magic Collinn y pagar en el hotel."
          />
        </div>
        <Inicio />
      </Shell>
    );
  }

  // INICIADA (esperando webhook) o PENDIENTE (OXXO/efectivo)
  return (
    <Shell
      icon={<Clock className="size-8" aria-hidden />}
      tone="muted"
      titulo="Estamos confirmando tu pago"
      texto="En cuanto Mercado Pago confirme el pago te enviamos la confirmación por correo y WhatsApp. Puede tardar unos minutos."
    >
      {recap}
      <WhatsAppBtn
        className="mt-6"
        msg={`Hola, soy ${view.nombre}. Acabo de pagar mi reserva ${ref} en Magic Collinn.`}
      />
      <Inicio />
    </Shell>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={strong ? "font-semibold text-primary" : "font-medium"}>{v}</dd>
    </div>
  );
}

function Inicio() {
  return (
    <Link
      href="/"
      className="mt-5 inline-block text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      Volver al inicio
    </Link>
  );
}

function WhatsAppBtn({
  msg,
  variant,
  className,
}: {
  msg: string;
  variant?: "secondary";
  className?: string;
}) {
  return (
    <Button
      variant={variant}
      className={`h-11 gap-2 px-6 ${className ?? ""}`}
      render={<a href={waLink(msg)} target="_blank" rel="noopener noreferrer" />}
    >
      <MessageCircle className="size-4" aria-hidden /> WhatsApp
    </Button>
  );
}

function Shell({
  icon,
  tone,
  titulo,
  texto,
  children,
}: {
  icon: React.ReactNode;
  tone: "success" | "error" | "muted";
  titulo: string;
  texto: string;
  children?: React.ReactNode;
}) {
  const toneCls =
    tone === "success"
      ? "bg-support/15 text-support"
      : tone === "error"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-28 pb-20 sm:px-6">
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div
          className={`mx-auto inline-flex size-14 items-center justify-center rounded-full ${toneCls}`}
        >
          {icon}
        </div>
        <h1 className="mt-4 font-heading text-2xl font-semibold">{titulo}</h1>
        <p className="mx-auto mt-2 max-w-md leading-relaxed text-muted-foreground">
          {texto}
        </p>
        {children}
      </div>
    </div>
  );
}
