"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Users, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/motion/easing";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function todayISO(): string {
  // yyyy-mm-dd en zona local
  return new Date().toLocaleDateString("en-CA");
}

interface Props {
  className?: string;
  initialCheckin?: string;
  initialCheckout?: string;
  initialHuespedes?: number;
  tipo?: string; // se preserva en la query si viene
}

// Campos nativos (input type=date + select) dentro de un <form>: fiables en todo
// navegador y con el mejor selector de fecha en móvil. Estilizados para verse
// igual que el resto del sitio.
export function BookingWidget({
  className,
  initialCheckin,
  initialCheckout,
  initialHuespedes,
  tipo,
}: Props) {
  const router = useRouter();
  const [checkin, setCheckin] = useState(initialCheckin ?? "");
  const [checkout, setCheckout] = useState(initialCheckout ?? "");
  const [huespedes, setHuespedes] = useState(String(initialHuespedes ?? 2));
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const today = todayISO();

  function onCheckin(value: string) {
    setCheckin(value);
    // Si la salida quedó antes o igual, la limpiamos
    if (checkout && checkout <= value) setCheckout("");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkin || !checkout) {
      setError("Selecciona tus fechas de llegada y salida.");
      return;
    }
    if (checkout <= checkin) {
      setError("La salida debe ser posterior a la llegada.");
      return;
    }
    setError(null);
    const params = new URLSearchParams({ checkin, checkout, huespedes });
    if (tipo) params.set("tipo", tipo);
    router.push(`/buscar?${params.toString()}`);
  }

  const field =
    "flex h-full w-full flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors focus-within:border-primary/60";
  const labelCls =
    "flex items-center gap-1.5 text-xs font-medium text-muted-foreground";
  const control =
    "w-full bg-transparent text-sm font-medium text-foreground outline-none";

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "rounded-2xl border border-border/70 bg-card/95 p-3 shadow-xl shadow-brand/5 backdrop-blur",
        className,
      )}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.8fr_auto]">
        {/* Llegada */}
        <label className={field}>
          <span className={labelCls}>
            <CalendarDays className="size-3.5" aria-hidden /> Llegada
          </span>
          <input
            type="date"
            required
            value={checkin}
            min={today}
            onChange={(e) => onCheckin(e.target.value)}
            aria-label="Fecha de llegada"
            className={cn(control, "[color-scheme:light]")}
          />
        </label>

        {/* Salida */}
        <label className={field}>
          <span className={labelCls}>
            <CalendarDays className="size-3.5" aria-hidden /> Salida
          </span>
          <input
            type="date"
            required
            value={checkout}
            min={checkin || today}
            onChange={(e) => setCheckout(e.target.value)}
            aria-label="Fecha de salida"
            className={cn(control, "[color-scheme:light]")}
          />
        </label>

        {/* Huéspedes */}
        <label className={field}>
          <span className={labelCls}>
            <Users className="size-3.5" aria-hidden /> Huéspedes
          </span>
          <select
            value={huespedes}
            onChange={(e) => setHuespedes(e.target.value)}
            aria-label="Número de huéspedes"
            className={control}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "huésped" : "huéspedes"}
              </option>
            ))}
          </select>
        </label>

        {/* CTA */}
        <button
          type="submit"
          className={cn(
            buttonVariants(),
            "h-full min-h-13 gap-2 px-6 text-base max-lg:mt-1",
          )}
        >
          <Search className="size-4" aria-hidden />
          Buscar disponibilidad
        </button>
      </div>

      {error && (
        <motion.p
          role="alert"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          className="px-2 pt-2 text-sm text-destructive"
        >
          {error}
        </motion.p>
      )}
    </form>
  );
}
