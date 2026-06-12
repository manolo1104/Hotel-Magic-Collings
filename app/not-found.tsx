import Link from "next/link";
import { Leaf, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 items-center px-4 pt-28 pb-20 sm:px-6">
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Leaf className="size-7 text-support" strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="mt-6 font-heading text-3xl font-semibold sm:text-4xl">
          Página no encontrada
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          La página que buscas no existe o cambió de lugar. Te ayudamos a volver
          al camino.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button className="h-11 px-6" render={<Link href="/" />}>
            Ir al inicio
          </Button>
          <Button
            variant="secondary"
            className="h-11 gap-1.5 px-6"
            render={<Link href="/habitaciones" />}
          >
            Ver habitaciones
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          ¿Buscabas algo del blog?{" "}
          <Link
            href="/blog"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Visita nuestras guías de la Huasteca
          </Link>
        </p>
      </div>
    </div>
  );
}
