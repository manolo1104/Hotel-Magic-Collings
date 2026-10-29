import { BedDouble } from "lucide-react";
import { camasCorto } from "@/lib/camas";
import { cn } from "@/lib/utils";

// Camas de la habitación junto al «Hasta N»: «1 King Size · 2 individuales en litera».
export function ChipCamas({ camas, className }: { camas: readonly string[]; className?: string }) {
  const texto = camasCorto(camas);
  if (!texto) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <BedDouble className="size-3.5 shrink-0" aria-hidden /> {texto}
    </span>
  );
}
