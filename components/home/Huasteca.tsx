import Link from "next/link";
import { ArrowRight, Waves } from "lucide-react";
import { Photo } from "@/components/Photo";
import { getAllPosts } from "@/lib/content";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

// Sección de destino: posiciona al hotel como BASE de operaciones para la
// Huasteca. Vende la experiencia (no solo el cuarto) y captura búsquedas de
// destino enlazando a las guías reales del blog.
const DESTACADOS = [
  "cascadas-cerca-de-axtla-de-terrazas",
  "que-hacer-en-axtla-de-terrazas",
  "gastronomia-huasteca-que-comer-en-axtla",
];

export function Huasteca() {
  const posts = getAllPosts();
  const guias = DESTACADOS.map((slug) => posts.find((p) => p.slug === slug)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 md:py-28">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-end">
        <Reveal>
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <Waves className="size-4" strokeWidth={1.75} aria-hidden />
            Tu base en la Huasteca Potosina
          </p>
          <h2 className="mt-4 max-w-2xl font-heading text-3xl font-semibold leading-[1.08] sm:text-4xl lg:text-5xl">
            Duerme en el centro, despierta entre cascadas
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Axtla es la puerta de entrada a las aguas turquesa de la Huasteca:
            cascadas y pozas a un paso, la surrealista Xilitla de Las Pozas y una
            cocina que va del zacahuil a los bocoles. Tú regresas a descansar al
            centro, cerca de todo.
          </p>
        </Reveal>
      </div>

      <Stagger className="mt-14 grid gap-6 md:grid-cols-3">
        {guias.map((g) => (
          <StaggerItem key={g.slug} className="h-full">
            <Link
              href={`/blog/${g.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover-hover:-translate-y-1.5 hover-hover:shadow-xl hover-hover:shadow-brand/5"
            >
              <div className="relative aspect-[16/11] overflow-hidden">
                <Photo
                  src={g.cover ?? ""}
                  alt={g.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-heading text-lg font-semibold leading-snug">
                  {g.title}
                </h3>
                <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {g.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Leer la guía
                  <ArrowRight
                    className="size-4 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-10">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Ver todas las guías de la Huasteca
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Reveal>
    </section>
  );
}
