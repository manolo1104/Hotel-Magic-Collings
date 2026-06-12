import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Fechas y habitación", "Tus datos", "Confirmación por WhatsApp"];

/** Indicador del flujo de reserva (3 pasos con verbos reales). */
export function BookingSteps({
  current,
  className,
}: {
  current: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <nav aria-label="Progreso de tu reserva" className={className}>
      <ol className="flex w-full max-w-xl items-center text-xs sm:text-sm">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          const last = i === STEPS.length - 1;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={cn("flex items-center gap-1.5", !last && "flex-1")}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                  done && "border-support bg-support text-white",
                  active && "border-primary text-primary",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" /> : n}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                  !active && "hidden sm:inline",
                )}
              >
                {label}
              </span>
              {!last && (
                <span
                  aria-hidden
                  className="mx-2 h-px min-w-3 flex-1 bg-border sm:mx-3"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
