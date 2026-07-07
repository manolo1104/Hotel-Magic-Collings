# CHANGELOG — Rediseño Magic Collinn

> Rama: `rediseno-clase-mundial` (desde `origin/main` limpio). **Nada publicado** aún.
> Cada fase = un commit atómico. El trabajo de backend previo (24 arreglos + pago
> embebido MP) se preservó intacto en la rama `backend-pendiente`.

---

## Fase 0 — Auditoría + bug real de precios `$0`
- `AUDIT.md`: arquitectura, deuda técnica, tabla de prioridades (impacto×esfuerzo)
  y **estado real de los 4 "bugs" del prompt** (solo el `$0` estaba vivo; la marca
  "Collings", el DOM de /habitaciones y el FAQ ya estaban bien o no se reproducían).
- **Fix `$0` (crítico):** el componente `CountUp` renderizaba `$0` en el servidor
  y solo ponía el precio real en el navegador (malo para SEO y confianza). Nuevo
  `components/Precio.tsx` (estático, SSR). Regla permanente: tarifa inválida →
  "Consultar tarifa", **nunca `$0`** + log de error.
- `formatMXN` movido a `lib/utils`. Eliminado `components/motion/CountUp.tsx`.

## Fase 1 — Sistema de diseño
- **Tipografía editorial: Fraunces** (serif con carácter, línea Aman/Hoxton)
  reemplaza a Bricolage Grotesque; se mantiene Hanken Grotesk para cuerpo/UI.
- Logo oficial guardado en `public/marca/logo.png`.
- **Paleta:** se conservó la actual (verde bosque + terracota + crema) **por
  decisión del dueño** (se probó una derivada del logo y se descartó).

## Fase 2 — Home orientado a conversión
- **`BarraValor`**: barra de propuesta de valor directa (mejor precio · cancela
  72 h · WhatsApp) justo después del hero.
- **`RatingBadge`** reutilizable (★ 4.5 · 122 reseñas) junto a los CTAs (hero + CTA final).
- **Habitaciones**: amenidades clave + precio real + CTA **"Reservar" directo por
  categoría** (`/buscar?tipo=slug`), no a página intermedia.
- **Comparativa honesta** directo vs. OTA (en `Estancia`).
- **`Huasteca`**: nueva sección de destino (cascadas/Xilitla/gastronomía) con
  enlaces a las guías reales del blog.
- **FAQ** reconstruido con `<details>`/`<summary>` nativos (accesible + contenido
  siempre en el HTML servido).
- CTA final con urgencia honesta ("Solo 6 habitaciones").

## Fase 3 — Flujo de reserva (sin cambiar a Kora, motor intacto)
- Se conserva el motor y el pago de Mercado Pago tal cual (decisión del dueño).
- **Única mejora:** recuperación de disponibilidad — cuando no hay lugar, deja de
  ser callejón sin salida: "Cambiar fechas" + WhatsApp con fechas y huéspedes
  **precargados** para pedir las fechas disponibles más cercanas.

## Fase 4 — Backend (ligera, sin conflicto)
- **Anti-spam** en el formulario de contacto: honeypot + tiempo mínimo (2.5 s).
- `.env.example` ya estaba completo (DB, MP, Resend, Kora, admin, cron, GA).
- **Diferido a propósito** (se pisa con `backend-pendiente`): zod server-side,
  rate-limit en endpoints, esquema de temporadas. Se reconcilian al juntar ramas.

## Fase 5 — SEO, rendimiento y medición
- **Rendimiento:** `next.config` acota `deviceSizes` a máx **1920** (antes hasta
  3840/4K sin necesidad) → menos bytes en móvil, mejor LCP/INP.
- **Medición desactivable:** `lib/track.ts` (no-op sin proveedor); GA4 se activa
  con `NEXT_PUBLIC_GA_ID`. Primer evento cableado: `whatsapp_click`.
- **SEO/Schema** ya venía fuerte (`@graph` Hotel + WebSite + FAQPage + HotelRoom +
  Breadcrumb, `aggregateRating` 4.5/122, sitemap/robots/OG/llms.txt) — sin cambios.

## Fase 6 — QA y entrega
- `npm run build` limpio · typecheck sin errores.
- **Re-verificados los 4 bugs de la Fase 0** en el build de producción: cero `$0`
  (precios reales $850/$1,200), cero "Collings", DOM correcto en /habitaciones,
  respuestas del FAQ en el HTML servido.
- **Lighthouse móvil:** Accessibility **97** · Best Practices **100** · SEO **100**
  · Performance **78** (CLS 0, FCP 1.4 s; LCP 5.1 s = único pendiente, ver
  `PENDIENTES.md` §6 — es el hero animado por JS, no el peso de imagen).
- Este `CHANGELOG.md` + `PENDIENTES.md`.
