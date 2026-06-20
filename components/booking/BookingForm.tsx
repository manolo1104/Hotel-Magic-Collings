"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  MessageCircle,
  Loader2,
  CalendarPlus,
  CreditCard,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/motion/easing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { waLink } from "@/lib/site";
import { bookingIcs } from "@/lib/ics";
import type { ModalidadPago } from "@/lib/booking/types";

interface Props {
  slug: string;
  nombre: string;
  checkin: string;
  checkout: string;
  huespedes: number;
  // Labels ya formateados en el servidor (evita importar el engine en cliente)
  checkinLabel: string;
  checkoutLabel: string;
  totalLabel: string;
  // Pago en línea (Mercado Pago). Si false, flujo de reserva por WhatsApp.
  pagoActivo: boolean;
  anticipoLabel: string; // 50% del total, ya formateado
}

type Status = "idle" | "loading" | "error" | "success";

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
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string>("");
  const [form, setForm] = useState({ nombre: "", whatsapp: "", email: "" });
  const [modalidad, setModalidad] = useState<ModalidadPago>("total");
  const reduce = useReducedMotion();

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      if (pagoActivo) {
        // Crea la reserva (hold) + preferencia y redirige a Checkout Pro.
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
        if (!res.ok || !data.ok || !data.initPoint) {
          setStatus("error");
          setError(data.error ?? "No pudimos iniciar el pago. Intenta de nuevo.");
          return;
        }
        window.location.href = data.initPoint; // → Mercado Pago
        return;
      }

      // Flujo sin pago en línea: reserva y confirmación por WhatsApp.
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, checkin, checkout, huespedes, ...form }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus("error");
        setError(data.error ?? "No pudimos crear la reserva. Intenta de nuevo.");
        return;
      }
      setBookingId(String(data.id));
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Hubo un problema de conexión. Intenta de nuevo.");
    }
  }

  // Éxito inline (solo flujo WhatsApp; con pago se redirige a Mercado Pago)
  if (status === "success") {
    const ref = bookingId.slice(0, 8).toUpperCase();
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
          ¡Reserva recibida!
        </h2>
        <p className="mx-auto mt-2 max-w-md leading-relaxed text-muted-foreground">
          Tu número de reserva es{" "}
          <strong className="text-foreground">{ref}</strong>. Te confirmamos por
          WhatsApp en menos de 24 horas. El pago se realiza directamente en el
          hotel.
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
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Huéspedes</dt>
            <dd className="font-medium">{huespedes}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-2">
            <dt className="font-medium">Total</dt>
            <dd className="font-semibold text-primary">{totalLabel}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            className="h-11 gap-2 px-6"
            render={
              <a href={waLink(msg)} target="_blank" rel="noopener noreferrer" />
            }
          >
            <MessageCircle className="size-4" aria-hidden />
            Confirmar por WhatsApp
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

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-card p-6 sm:p-8"
    >
      <h2 className="font-heading text-xl font-semibold">Tus datos</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {pagoActivo
          ? "Elige cómo pagar y te llevamos a Mercado Pago para completar tu reserva de forma segura."
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
          <p className="text-xs text-muted-foreground">
            Lo usamos solo para confirmar tu reserva.
          </p>
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

      {/* Selector total / anticipo (solo con pago en línea) */}
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

      {status === "error" && error && (
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
        disabled={status === "loading"}
        className="mt-6 h-12 w-full gap-2 text-base"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />{" "}
            {pagoActivo ? "Redirigiendo a Mercado Pago…" : "Enviando…"}
          </>
        ) : pagoActivo ? (
          <>
            <CreditCard className="size-4" aria-hidden /> Pagar y reservar
          </>
        ) : (
          "Confirmar reserva"
        )}
      </Button>

      {pagoActivo && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pago seguro con Mercado Pago. Cancela hasta 72 h antes.
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
