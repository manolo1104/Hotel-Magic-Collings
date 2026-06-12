// Skeleton de /buscar: imita la forma real (header + widget + tarjetas)
// mientras el servidor consulta la disponibilidad.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-28 pb-20 sm:px-6">
      <div className="max-w-2xl">
        <div className="h-10 w-72 animate-pulse rounded-lg bg-muted" />
        <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded-lg bg-muted" />
      </div>

      {/* Buscador */}
      <div className="mt-6 h-24 max-w-4xl animate-pulse rounded-2xl border border-border bg-muted/60" />

      {/* Tarjetas de habitación */}
      <div className="mt-10 grid gap-5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="grid overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[300px_1fr]"
          >
            <div className="aspect-[4/3] animate-pulse bg-muted md:aspect-auto md:h-56" />
            <div className="flex flex-col gap-3 p-6">
              <div className="h-6 w-56 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-full animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded-lg bg-muted" />
              <div className="mt-auto flex items-end justify-between border-t border-border pt-4">
                <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
                <div className="h-11 w-32 animate-pulse rounded-lg bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
