// Skeleton de /habitaciones: imita el layout real (header + bloques con
// galería y contenido) mientras se leen los tipos desde la base de datos.
export default function Loading() {
  return (
    <div className="pt-28 pb-20">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="h-12 w-96 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="mt-4 h-5 w-80 max-w-full animate-pulse rounded-lg bg-muted" />
      </div>

      <div className="mx-auto mt-14 flex max-w-[1400px] flex-col gap-20 px-4 sm:px-6">
        {[0, 1].map((i) => (
          <div key={i} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 aspect-[16/10] animate-pulse rounded-2xl bg-muted" />
              <div className="aspect-square animate-pulse rounded-xl bg-muted" />
              <div className="aspect-square animate-pulse rounded-xl bg-muted" />
            </div>
            <div>
              <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
              <div className="mt-4 h-4 w-full animate-pulse rounded-lg bg-muted" />
              <div className="mt-2 h-4 w-5/6 animate-pulse rounded-lg bg-muted" />
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="h-4 w-32 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
                <div className="h-11 w-32 animate-pulse rounded-lg bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
