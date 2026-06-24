"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  MessageCircle,
  Loader2,
  CalendarPlus,
  CreditCard,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/motion/easing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { waLink } from "@/lib/site";
import { bookingIcs } from "@/lib/ics";
import { PaymentBrick } from "./PaymentBrick";
import type { ModalidadPago } from "@/lib/booking/types";

interface Props {
  slug: string;
  nombre: string;
  checkin: string;
  checkout: string;
  huespedes: number;
  checkinLabel: string;
  checkoutLabel: string;
  totalLabel: string;
  pagoActivo: boolean;
  anticipoLabel: string;
  publicKey: string;
}

type Step = "datos" | "pago" | "pendiente" | "success";

export function BookingForm({
  slug,
  nombre,
  checkin,
  checkout,
  huespedes,
  checkinLabel,
  checkoutLabel,
  totalLabel,
  pagoActivo,
  anticipoLabel,
  publicKey,
}: Props) {
  const [step, setStep] = useState<Step>("datos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: "", whatsapp: "", email: "" });
  const [modalidad, setModalidad] = useState<ModalidadPago>("total");
  const [bookingId, setBookingId] = useState("");
  const [monto, setMonto] = useState(0);
  const [pagado, setPagado] = useState(false);
  const reduce = useReducedMotion();

  const ref = bookingId.slice(0, 8).toUpperCase();

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Paso 1: crear la reserva → ir al pago embebido (o flujo WhatsApp)
  async function handleContinuar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (pagoActivo) {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            checkin,
            checkout,
            huespedes,
            ...form,
            modalidadPago: modalidad,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error ?? "No pudimos iniciar la reserva.");
          setLoading(false);
          return;
        }
        setBookingId(String(data.bookingId));
        setMonto(Number(data.montoACobrar));
        setStep("pago");
        setLoading(false);
      } else {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, checkin, checkout, huespedes, ...form }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error ?? "No pudimos crear la reserva.");
          setLoading(false);
          return;
        }
        setBookingId(String(data.id));
        setStep("success");
      }
    } catch {
      setError("Hubo un problema de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  // Paso 2: procesar el pago con el token del Brick. Lanza si se rechaza
  // (para que el propio Brick muestre el error y permita reintentar).
  async function handlePago(formData: unknown) {
    setError(null);
    const res = await fetch("/api/pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, formData }),
    });
    const data = await res.json();
    if (res.ok && data.ok && data.status === "approved") {
      setPagado(true);
      setStep("success");
      return;
    }
    if (res.ok && data.pendiente) {
      setStep("pendiente");
      return;
    }
    throw new Error(data.error ?? "El pago no se completó.");
  }

  // ── PASO: éxito ──────────────────────────────────────────
  if (step === "success") {
    const msg = `Hola, acabo de reservar una ${nombre} en Magic Collinn del ${checkin} al ${checkout} para ${huespedes} huéspedes. Mi número de reserva es ${ref}.`;
    return (
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", duration: 0.55, bounce: 0.25 }}
        className="rounded-2xl border border-border bg-card p-8 text-center"
      >
        <motion.div
          initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6, bounce: 0.45, delay: 0.12 }}
          className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-support/15 text-support"
        >
          <CheckCircle2 className="size-8" aria-hidden />
        </motion.div>
        <h2 className="mt-4 font-heading text-2xl font-semibold">
          {pagado ? "¡Reserva confirmada!" : "¡Reserva recibida!"}
        </h2>
        <p className="mx-auto mt-2 max-w-md leading-relaxed text-muted-foreground">
          Tu número de reserva es <strong className="text-foreground">{ref}</strong>.{" "}
          {pagado
            ? "Recibimos tu pago. Te enviamos la confirmación por correo."
            : "Te confirmamos por WhatsApp en menos de 24 horas. El pago se realiza en el hotel."}
        </p>

        <dl className="mx-auto mt-6 max-w-xs space-y-2 rounded-xl bg-secondary/50 p-4 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Llegada</dt>
            <dd className="font-medium">{checkinLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Salida</dt>
            <dd className="font-medium">{checkoutLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Habitación</dt>
            <dd className="font-medium">{nombre}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-2">
            <dt className="font-medium">Total</dt>
            <dd className="font-semibold text-primary">{totalLabel}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            className="h-11 gap-2 px-6"
            render={<a href={waLink(msg)} target="_blank" rel="noopener noreferrer" />}
          >
            <MessageCircle className="size-4" aria-hidden />
            {pagado ? "Escríbenos por WhatsApp" : "Confirmar por WhatsApp"}
          </Button>
          <Button
            variant="secondary"
            className="h-11 gap-2 px-6"
            render={
              <a
                href={`data:text/calendar;charset=utf-8,${encodeURIComponent(
                  bookingIcs({ ref, checkin, checkout }),
                )}`}
                download="reserva-magic-collinn.ics"
              />
            }
          >
            <CalendarPlus className="size-4" aria-hidden />
            Agregar a tu calendario
          </Button>
        </div>
        <Link
          href="/"
          className="mt-5 inline-block text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Volver al inicio
        </Link>
      </motion.div>
    );
  }

  // ── PASO: pago pendiente (OXXO / revisión) ───────────────
  if (step === "pendiente") {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Clock className="size-8" aria-hidden />
        </div>
        <h2 className="mt-4 font-heading text-2xl font-semibold">Estamos confirmando tu pago</h2>
        <p className="mx-auto mt-2 max-w-md leading-relaxed text-muted-foreground">
          En cuanto Mercado Pago confirme el pago (reserva{" "}
          <strong className="text-foreground">{ref}</strong>) te enviamos la
          confirmación por correo y WhatsApp.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  // ── PASO: pago embebido ──────────────────────────────────
  if (step === "pago") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <button
          onClick={() => setStep("datos")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver a tus datos
        </button>
        <h2 className="mt-3 font-heading text-xl font-semibold">Pago seguro</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pagas ahora{" "}
          <strong className="text-foreground">
            ${monto.toLocaleString("es-MX")} MXN
          </strong>{" "}
          · reserva {ref}. Tus datos de tarjeta los protege Mercado Pago.
        </p>
        <div className="mt-5">
          <PaymentBrick
            publicKey={publicKey}
            amount={monto}
            email={form.email || undefined}
            onPay={handlePago}
          />
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── PASO: datos del huésped ──────────────────────────────
  return (
    <form
      onSubmit={handleContinuar}
      className="rounded-2xl border border-border bg-card p-6 sm:p-8"
    >
      <h2 className="font-heading text-xl font-semibold">Tus datos</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {pagoActivo
          ? "Completa tus datos y elige cuánto pagar; el cobro se hace aquí mismo, sin salir del sitio."
          : "Completa para reservar. Sin pago en línea: te confirmamos por WhatsApp."}
      </p>

      <div className="mt-6 grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="nombre">Nombre completo</Label>
          <Input
            id="nombre"
            required
            autoComplete="name"
            value={form.nombre}
            onChange={(e) => update("nombre", e.target.value)}
            placeholder="Tu nombre"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.whatsapp}
            onChange={(e) => update("whatsapp", e.target.value)}
            placeholder="Ej. 481 123 4567"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">
            Correo{" "}
            <span className="text-muted-foreground">
              {pagoActivo ? "(para tu confirmación)" : "(opcional)"}
            </span>
          </Label>
          <Input
            id="email"
            type="email"
            required={pagoActivo}
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="tu@correo.com"
          />
        </div>
      </div>

      {pagoActivo && (
        <fieldset className="mt-6">
          <legend className="text-sm font-medium">¿Cuánto quieres pagar ahora?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <PagoOpcion
              activo={modalidad === "total"}
              onClick={() => setModalidad("total")}
              titulo="Pagar todo ahora"
              monto={totalLabel}
              detalle="Tu estancia queda 100% pagada"
            />
            <PagoOpcion
              activo={modalidad === "anticipo"}
              onClick={() => setModalidad("anticipo")}
              titulo="Pagar 50% ahora"
              monto={anticipoLabel}
              detalle="El resto se paga en el hotel"
            />
          </div>
        </fieldset>
      )}

      {error && (
        <motion.p
          role="alert"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </motion.p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="mt-6 h-12 w-full gap-2 text-base"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Un momento…
          </>
        ) : pagoActivo ? (
          <>
            <CreditCard className="size-4" aria-hidden /> Continuar al pago
          </>
        ) : (
          "Confirmar reserva"
        )}
      </Button>

      {pagoActivo && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pago seguro con Mercado Pago, dentro de este sitio. Cancela hasta 72 h antes.
        </p>
      )}
    </form>
  );
}

function PagoOpcion({
  activo,
  onClick,
  titulo,
  monto,
  detalle,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  monto: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-xl border p-4 text-left transition-colors ${
        activo
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/40"
      }`}
    >
      <span className="block text-sm font-medium">{titulo}</span>
      <span className="mt-1 block font-heading text-xl font-semibold text-primary">
        {monto}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{detalle}</span>
    </button>
  );
}
