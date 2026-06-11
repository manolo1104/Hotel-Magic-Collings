# Hotel Magic Collinn — sitio web

Sitio web del Hotel Magic Collinn (Axtla de Terrazas, San Luis Potosí) con
**motor de reservas propio**. Next.js 16 (App Router) + TypeScript + Tailwind v4 +
shadcn/ui + Drizzle ORM. En español, mobile-first.

## Cómo correrlo en tu computadora (localhost)

```bash
npm install        # instala dependencias (solo la primera vez)
npm run dev        # arranca el sitio en http://localhost:3000
```

No necesitas instalar ninguna base de datos. En desarrollo usa **PGlite** (un
Postgres embebido que se guarda solo en la carpeta `.pglite/`). La primera vez que
abres el sitio, se crean las 6 habitaciones automáticamente.

Comandos útiles:

```bash
npm run db:seed    # reinicia la base local (vuelve a dejar 2 tipos + 6 cuartos)
npm run typecheck  # revisa que no haya errores de tipos
npm run build      # build de producción
```

## Dónde editar el contenido

| Quiero cambiar… | Archivo |
|---|---|
| Nombre, WhatsApp, teléfono, correo, dirección, horarios, FAQ, amenidades | `lib/site.ts` |
| Tarifas, capacidad, descripciones de las habitaciones | `lib/db/seed-data.ts` (luego `npm run db:seed`) |
| Fotos (todas son de stock provisional) | `lib/images.ts` |
| Artículos del blog | crea archivos en `content/blog/*.mdx` |
| Colores y estilo | `app/globals.css` |

## Lo que falta (TODOs antes de publicar)

- [ ] Confirmar el dominio real en `lib/site.ts` (`url`).
- [ ] **Tarifas reales** por noche en `lib/db/seed-data.ts` y volver a sembrar.
- [ ] **Fotos reales** del hotel (reemplazar las de stock en `lib/images.ts`).
- [ ] WhatsApp, teléfono, correo y **dirección exacta** + coordenadas (`lib/site.ts`).
- [ ] Horarios de check-in / check-out y política de mascotas (`lib/site.ts`).
- [ ] `src` del iframe de Google Maps (`lib/site.ts → mapEmbedSrc`).
- [ ] URL de Formspree para el formulario de contacto (`components/ContactForm.tsx`).
- [ ] ID de Google Analytics (`lib/site.ts → gaId`).
- [ ] (Opcional) Activar el depósito con Stripe (está marcado como TODO).

## Publicar en internet (cuando esté listo)

1. Crear una base de datos Postgres gratis (Neon, Supabase o Railway) y copiar su URL.
2. En Vercel, crear el proyecto desde este repositorio.
3. Agregar la variable de entorno `DATABASE_URL` con esa URL (ver `.env.example`).
4. Desplegar. La primera vez se crean las tablas y las 6 habitaciones solas.

> El sitio funciona igual en localhost y en producción: solo cambia que en
> producción `DATABASE_URL` apunta al Postgres en la nube en lugar de PGlite local.
