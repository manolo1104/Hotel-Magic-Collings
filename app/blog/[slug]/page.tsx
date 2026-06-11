import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/Photo";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronRight, ArrowLeft, Leaf, Clock, MessageCircle } from "lucide-react";
import {
  getAllSlugs,
  getPostBySlug,
  getRelatedPosts,
  readingMinutes,
} from "@/lib/content";
import { site, waLink } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/JsonLd";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { Reveal } from "@/components/motion/Reveal";
import { WordsReveal } from "@/components/motion/WordsReveal";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { ReadingProgress } from "@/components/motion/ReadingProgress";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Artículo no encontrado" };
  return {
    title: post.meta.title,
    description: post.meta.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      title: post.meta.title,
      description: post.meta.description,
      images: post.meta.cover ? [post.meta.cover] : undefined,
    },
  };
}

function fmt(iso: string): string {
  try {
    return format(new Date(`${iso}T12:00:00`), "d 'de' MMMM, yyyy", { locale: es });
  } catch {
    return iso;
  }
}

export default async function PostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { meta, content } = post;
  const minutes = readingMinutes(content);
  const related = getRelatedPosts(slug, 3);

  return (
    <article className="pt-28 pb-20">
      <ReadingProgress />
      <JsonLd data={articleJsonLd(meta)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: meta.title, url: `/blog/${slug}` },
        ])}
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {/* Breadcrumb */}
        <nav
          aria-label="Ruta de navegación"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground">
            Inicio
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <Link href="/blog" className="hover:text-foreground">
            Blog
          </Link>
        </nav>

        <header className="mt-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Leaf className="size-4 text-support" aria-hidden />
              Equipo de Magic Collinn
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> {minutes} min de lectura
            </span>
          </div>
          <h1 className="mt-3 font-heading text-3xl font-semibold leading-tight sm:text-4xl">
            <WordsReveal text={meta.title} />
          </h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {meta.description}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {meta.updated ? "Actualizado el " : "Publicado el "}
            <time dateTime={meta.updated ?? meta.date}>
              {fmt(meta.updated ?? meta.date)}
            </time>
            {meta.updated && meta.updated !== meta.date ? (
              <>
                {" · publicado el "}
                <time dateTime={meta.date}>{fmt(meta.date)}</time>
              </>
            ) : null}
          </p>
          {meta.tags && meta.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {meta.tags.map((t) => (
                <li
                  key={t}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {t}
                </li>
              ))}
            </ul>
          )}
        </header>

        {meta.cover && (
          <ClipReveal className="relative mt-8 aspect-[16/9] overflow-hidden rounded-2xl">
            <Photo
              src={meta.cover}
              alt={meta.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </ClipReveal>
        )}

        <div className="prose prose-neutral mt-10 max-w-none prose-headings:font-heading prose-headings:font-semibold prose-h2:text-2xl prose-a:text-primary prose-a:underline-offset-4 prose-strong:text-foreground">
          <MDXRemote source={content} />
        </div>

        {/* CTA de reserva */}
        <Reveal direction="scale" className="mt-12 rounded-2xl border border-border bg-secondary/40 p-8 text-center">
          <h2 className="font-heading text-2xl font-semibold">
            Tu lugar en el centro de Axtla
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Reserva directo en Magic Collinn y vive la Huasteca desde un hotel
            boutique en pleno centro.
          </p>
          <Button
            className="mt-5 h-11 px-6"
            render={<Link href="/buscar" />}
          >
            Buscar disponibilidad
          </Button>
        </Reveal>

        {/* Sobre el autor (señal E-E-A-T: fuente local, transparencia) */}
        <div className="mt-12 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-start">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <Leaf className="size-6 text-support" aria-hidden />
          </span>
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Sobre {site.name}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Somos un hotel boutique en el centro de {site.locality}. Vivimos
              aquí y conocemos la Huasteca Potosina de primera mano: escribimos
              estas guías para ayudarte a planear tu viaje con información local y
              actual. ¿Tienes una duda concreta? Escríbenos por WhatsApp y con
              gusto te orientamos.
            </p>
            <a
              href={waLink(
                `Hola, leí su blog sobre Axtla y tengo una duda.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <MessageCircle className="size-4" aria-hidden />
              Escríbenos por WhatsApp
            </a>
          </div>
        </div>

        {/* Sigue leyendo (enlazado interno) */}
        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="font-heading text-xl font-semibold">Sigue leyendo</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
                >
                  <span className="text-xs text-muted-foreground">
                    {fmt(p.date)}
                  </span>
                  <h3 className="mt-1.5 font-heading text-base font-semibold leading-snug group-hover:text-brand">
                    {p.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden /> Volver al blog
          </Link>
        </div>
      </div>
    </article>
  );
}
