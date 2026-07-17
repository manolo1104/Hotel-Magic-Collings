"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Users, Search, Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/motion/easing";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/track";

const STORAGE_KEY = "mc_busqueda";

function todayISO(): string {
  // yyyy-mm-dd en zona local
  return new Date().toLocaleDateString("en-CA");
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function nightsBetween(checkin: string, checkout: string): number {
  if (!checkin || !checkout || checkout <= checkin) return 0;
  const a = new Date(`${checkin}T12:00:00`).getTime();
  const b = new Date(`${checkout}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
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
  const [pending, startTransition] = useTransition();
  const reduce = useReducedMotion();
  const today = todayISO();
  const noches = nightsBetween(checkin, checkout);

  // Memoria de búsqueda: el widget "limpio" (el del hero) recupera la última
  // búsqueda guardada, si sigue siendo vigente. Corre post-mount (sin SSR mismatch).
  const hydrateFromStorage = !initialCheckin && !initialCheckout;
  useEffect(() => {
    if (!hydrateFromStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as {
        checkin?: string;
        checkout?: string;
        huespedes?: string;
      };
      if (s.checkin && s.checkout && s.checkin >= todayISO() && s.checkout > s.checkin) {
        setCheckin(s.checkin);
        setCheckout(s.checkout);
        if (s.huespedes) setHuespedes(s.huespedes);
      }
    } catch {
      // storage corrupto o bloqueado: ignorar
    }
  }, [hydrateFromStorage]);

  function onCheckin(value: string) {
    setCheckin(value);
    // Anticipación: sugiere la salida al día siguiente (o corrígela si quedó antes)
    if (value && (!checkout || checkout <= value)) {
      setCheckout(addDaysISO(value, 1));
    }
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
    track("search_availability", {
      checkin,
      checkout,
      huespedes: Number(huespedes),
      noches: nightsBetween(checkin, checkout),
    });
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ checkin, checkout, huespedes }),
      );
    } catch {
      // sin storage disponible: no pasa nada
    }
    const params = new URLSearchParams({ checkin, checkout, huespedes });
    if (tipo) params.set("tipo", tipo);
    startTransition(() => {
      router.push(`/buscar?${params.toString()}`);
    });
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
          disabled={pending}
          className={cn(
            buttonVariants(),
            "h-full min-h-13 gap-2 px-6 text-base max-lg:mt-1",
          )}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Buscando…
            </>
          ) : (
            <>
              <Search className="size-4" aria-hidden />
              Buscar disponibilidad
            </>
          )}
        </button>
      </div>

      {noches > 0 && !error && (
        <p className="px-2 pt-2 text-xs font-medium text-muted-foreground">
          {noches} {noches === 1 ? "noche" : "noches"}
        </p>
      )}

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
