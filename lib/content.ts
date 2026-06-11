// ============================================================
// Blog MDX — lee content/blog/*.mdx con frontmatter.
// Para agregar un post nuevo, basta con crear otro archivo .mdx.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const DIR = path.join(process.cwd(), "content/blog");

export interface PostMeta {
  title: string;
  slug: string;
  description: string;
  date: string; // yyyy-mm-dd (publicado)
  updated?: string; // yyyy-mm-dd (última actualización)
  cover?: string;
  tags?: string[];
}

export interface Post {
  meta: PostMeta;
  content: string;
}

/** Minutos de lectura estimados (~200 palabras/min). */
export function readingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/** Otros posts (para enlazado interno), excluye el actual. */
export function getRelatedPosts(slug: string, limit = 3): PostMeta[] {
  return getAllPosts()
    .filter((p) => p.slug !== slug)
    .slice(0, limit);
}

function readMeta(file: string): PostMeta {
  const raw = fs.readFileSync(path.join(DIR, file), "utf8");
  const { data } = matter(raw);
  const slug = (data.slug as string) ?? file.replace(/\.mdx$/, "");
  return { ...(data as Omit<PostMeta, "slug">), slug };
}

export function getAllPosts(): PostMeta[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map(readMeta)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | null {
  const file = path.join(DIR, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  return {
    meta: { ...(data as Omit<PostMeta, "slug">), slug: (data.slug as string) ?? slug },
    content,
  };
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}
