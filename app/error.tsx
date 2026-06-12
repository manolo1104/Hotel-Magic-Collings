"use client";

import { useEffect } from "react";
import { RotateCcw, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site, waLink } from "@/lib/site";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 items-center px-4 pt-28 pb-20 sm:px-6">
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
          Algo no salió como esperábamos
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Ocurrió un error al cargar esta página. Intenta de nuevo y, si el
          problema sigue, escríbenos por WhatsApp y te ayudamos con tu reserva.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button className="h-11 gap-2 px-6" onClick={reset}>
            <RotateCcw className="size-4" aria-hidden />
            Reintentar
          </Button>
          <Button
            variant="secondary"
            className="h-11 gap-2 px-6"
            render={
              <a
                href={waLink(
                  `Hola, tuve un problema en el sitio de ${site.name} y quiero hacer una reserva.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <MessageCircle className="size-4" aria-hidden />
            Escribir por WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
