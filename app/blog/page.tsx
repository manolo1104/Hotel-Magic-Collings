import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/Photo";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getAllPosts } from "@/lib/content";
import { Reveal } from "@/components/motion/Reveal";
import { WordsReveal } from "@/components/motion/WordsReveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guías y consejos para tu visita a Axtla de Terrazas y la Huasteca Potosina, del equipo del Hotel Magic Collinn.",
  alternates: { canonical: "/blog" },
};

function fmt(iso: string): string {
  try {
    return format(new Date(`${iso}T12:00:00`), "d 'de' MMMM, yyyy", { locale: es });
  } catch {
    return iso;
  }
}

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-28 pb-20 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="font-heading text-4xl font-semibold sm:text-5xl">
          <WordsReveal text="Blog" />
        </h1>
        <Reveal delay={0.25} className="mt-4">
          <p className="leading-relaxed text-muted-foreground">
            Ideas, rutas y recomendaciones para aprovechar tu visita a Axtla de
            Terrazas y la Huasteca Potosina.
          </p>
        </Reveal>
      </header>

      {posts.length === 0 ? (
        <p className="mt-12 text-muted-foreground">Pronto publicaremos contenido.</p>
      ) : (
        <Stagger className="mt-12 grid gap-6 sm:grid-cols-2">
          {posts.map((p) => (
            <StaggerItem key={p.slug} className="h-full">
              <Link
                href={`/blog/${p.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover-hover:-translate-y-1.5 hover-hover:shadow-xl hover-hover:shadow-brand/5"
              >
                {p.cover && (
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Photo
                      src={p.cover}
                      alt={p.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6">
                  <time className="text-xs font-medium text-muted-foreground">
                    {fmt(p.date)}
                  </time>
                  <h2 className="mt-2 font-heading text-xl font-semibold leading-snug transition-colors duration-200 group-hover:text-brand">
                    {p.title}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {p.description}
                  </p>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
