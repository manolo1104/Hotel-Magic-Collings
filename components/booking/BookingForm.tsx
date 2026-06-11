"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, MessageCircle, Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/motion/easing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { waLink } from "@/lib/site";

interface Props {
  slug: string;
  nombre: string;
  checkin: string;
  checkout: string;
  huespedes: number;
}

type Status = "idle" | "loading" | "error" | "success";

export function BookingForm({ slug, nombre, checkin, checkout, huespedes }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string>("");
  const [form, setForm] = useState({ nombre: "", whatsapp: "", email: "" });
  const reduce = useReducedMotion();

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
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
            className="h-11 px-6"
            render={<Link href="/" />}
          >
            Volver al inicio
          </Button>
        </div>
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
        Completa para reservar. Sin pago en línea: te confirmamos por WhatsApp.
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
            Correo <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="tu@correo.com"
          />
        </div>
      </div>

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
            <Loader2 className="size-4 animate-spin" aria-hidden /> Enviando…
          </>
        ) : (
          "Confirmar reserva"
        )}
      </Button>

      {/* TODO (opcional): depósito 20–30% con Stripe antes de confirmar. */}
    </form>
  );
}
