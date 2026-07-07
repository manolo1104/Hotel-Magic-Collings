# AUDIT.md — Hotel Magic Collinn (auditoría Fase 0)

> Fecha: 2026-07-07 · Repo: `Hotel-Magic-Collings` · Proyecto Vercel: `magic-collinn`
> Producción: https://magic-collinn.vercel.app · Dominio objetivo: hotelmagicollinn.com
> Carpeta local: `~/Desktop/magic-collinn-viejo` (el nombre "-viejo" es engañoso: **es el sitio en producción**).

Este documento es **solo diagnóstico**. No se tocó código de producto para generarlo.

---

## 1. Arquitectura actual

**Stack:** Next.js 16.2.9 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind v4 (`@theme` en `globals.css`) · shadcn/ui "base-nova" (usa `@base-ui/react`, no Radix) · Drizzle ORM · `motion` (framer) · MDX (blog).

**Rutas públicas:** `/`, `/habitaciones`, `/buscar` (motor de reserva), `/reservar`, `/contacto`, `/blog` + `/blog/[slug]`, `/privacidad`, `/reserva/{exito,pendiente,error}`.
**Panel privado:** `/admin/*` (reservas, calendario, cotizaciones, ingresos, clientes/CRM, operaciones, canales OTA, insights). Auth cookie HMAC. Chrome público oculto vía `PublicShell`.
**APIs:** `/api/availability`, `/api/bookings`, `/api/checkout`, `/api/pagar`, `/api/mp/webhook`, `/api/cron/ical-sync`, `/api/admin/*`.

**Capa de datos:**
- `lib/db/schema.ts` — Drizzle: `roomTypes` (tarifa_base integer), `rooms`, `bookings`, `blocks`, `guestNotes`, `quotes`.
- `lib/db/index.ts` — proxy perezoso; `DATABASE_URL`→Postgres (Railway) o cae a PGlite (memoria en Vercel).
- `lib/db/ensure.ts` — crea tablas y siembra 6 cuartos de forma idempotente.
- `lib/booking/engine.ts` — lógica pura + acceso a datos (`getAvailability`, `getRoomTypes`, `createBooking`, anti-overbooking). **Aislado por funciones, pero NO detrás de una interfaz TypeScript formal** (`BookingEngineAdapter`) como pide la Fase 3.
- Config de negocio centralizada: `lib/site.ts` · SEO: `lib/seo.ts` · imágenes: `lib/images.ts` · pagos: `lib/mp.ts` · correos: `lib/email/*` · Kora (stub): `lib/kora.ts`.

**Veredicto:** arquitectura sólida y bien separada. Es una base mucho más madura de lo que sugiere el prompt. El trabajo real es de **pulido quirúrgico y conversión**, no de reescritura.

---

## 2. Línea base (obligatoria antes de tocar nada)

| Chequeo | Resultado |
|---|---|
| `npm run build` | ✅ **exit 0** (limpio) |
| `npm run lint` | ⚠️ **8 problemas (5 errores, 3 warnings)** — todos `react-hooks/set-state-in-effect` |
| TypeScript | sin errores en build |

Los errores de lint no rompen el build pero deben corregirse (afectan a `CountUp` y algún componente de layout). **Regla adoptada: nada se mergea si el build se rompe.**

---

## 3. Estado de los 4 "bugs conocidos" del prompt

Verificados contra el **HTML servido en producción** + código fuente:

| # | Bug reportado | Estado real | Detalle |
|---|---|---|---|
| 1 | **Precios en $0** | 🔴 **REAL Y EN VIVO** | El HTML servido trae `$0 MXN` (2×) y **ningún precio real**. **Causa raíz: `components/motion/CountUp.tsx`** es cliente, inicia en `useState(0)` y solo anima al valor real tras entrar al viewport → el servidor **siempre** renderiza `$0`. Malo para SEO y confianza. |
| 2 | **FAQ sin respuestas** | 🟡 **Parcial / a confirmar** | Las respuestas **sí** están en el HTML servido (bien para SEO; el schema `FAQPage` ya existe). Falta verificar que el acordeón **expanda visualmente al hacer clic** (interacción). Riesgo bajo. |
| 3 | **Marca "Collings"** | 🟢 **YA CORREGIDO** | 0 ocurrencias visibles de "Collings" en el HTML (home y /habitaciones). Solo el nombre del **repo** dice "Collings" (no visible al usuario). |
| 4 | **/habitaciones DOM tras footer** | 🟢 **NO SE REPRODUCE** | `main#contenido` (pos 7446) va **antes** del `<footer>` (pos 9989). Jerarquía `header → main → footer` correcta. |

> **Hallazgo clave:** la lista de bugs del prompt está ~50% obsoleta. Solo el **$0** es un bug vivo de alto impacto. Esto reduce el riesgo/alcance del trabajo.

---

## 4. Deuda técnica y riesgos

| Tema | Descripción | Severidad |
|---|---|---|
| **Árbol de trabajo sucio** | 20 archivos modificados sin commit + 1 commit sin push (los "24 arreglos" de backend/admin + pago embebido Mercado Pago; verificados en localhost, **no** desplegados). Construir el rediseño encima los mezcla. | 🔴 Alta (decisión de negocio) |
| **`CountUp` en precios** | Antipatrón que causa el bug $0 + 4 de los 5 errores de lint. Los precios no deben "contar desde 0". | 🔴 Alta |
| **Datos placeholder** | Tarifas `$850/$1,200` marcadas `// TODO` (no reales). Fotos = stock Unsplash. NAP/tel parcialmente por confirmar. Rating: el código usa 5.0/8 reseñas reales, pero Google público muestra 4.5/122 (el prompt pide 4.5/122). | 🟠 Media (tope a "clase mundial") |
| **Adapter de reservas** | El motor está aislado por funciones pero sin interfaz TS formal `BookingEngineAdapter`. Migrar a Kora hoy exige tocar más de lo ideal. | 🟠 Media |
| **Imágenes sin `deviceSizes`** | `next.config` no acota `deviceSizes`/`imageSizes` → Next puede servir hasta `w=3840`. | 🟡 Baja-media |
| **Analytics/funnel** | GA depende de `site.gaId` (vacío). No hay eventos de embudo (view_room, begin_booking, whatsapp_click…). | 🟡 Media (medición) |
| **`force-dynamic` en home** | Home y /habitaciones leen BD por request (sin ISR/caché). Correcto para frescura, pero cada visita pega a la BD. | 🟡 Baja |

---

## 5. Rendimiento (observaciones)

- **Bien:** `next/image` con blur + lazy por defecto, `priority` solo en hero, `preconnect` al host de imágenes, fuentes con `next/font` + `display:swap`.
- **A mejorar:** acotar `deviceSizes`; revisar JS de cliente del hero (parallax + WordsReveal + Ken Burns) en móvil; medir LCP/CLS/INP reales (Next 16/Turbopack no imprime tabla de bundle → medir con Lighthouse en Fase 6).
- **Presupuesto objetivo (Fase 5):** LCP < 2.5 s (móvil 4G), CLS < 0.1, INP < 200 ms, Lighthouse ≥ 90 en las 4 categorías.

## 6. Accesibilidad (observaciones)

- **Bien:** skip-link, `aria-current`, focus visible, landmarks semánticos, alt en español.
- **A verificar (Fase 6):** contraste AA en overlays del hero, navegación por teclado del **flujo completo de reserva**, focus trap en lightbox/menú móvil.

---

## 7. Tabla priorizada (impacto × esfuerzo)

Orden de ejecución recomendado. Impacto = efecto en conversión/confianza/SEO. Esfuerzo = 1 (bajo) a 5 (alto).

| Prioridad | Acción | Impacto | Esfuerzo | Fase |
|---|---|---|---|---|
| **P0** | Arreglar `$0` (precios reales en SSR + fallback "Consultar tarifa" + fix lint) | 🔴 Muy alto | 2 | 0 |
| **P0** | Definir baseline limpio (resolver árbol sucio) | 🔴 Alto | 1 | 0 |
| **P1** | Barra de propuesta de valor directa + prueba social junto a CTAs (mayor lift de conversión) | 🔴 Alto | 2 | 2 |
| **P1** | Verificar/robustecer FAQ (interacción) + `<details>` accesible | 🟠 Medio | 1 | 0/2 |
| **P1** | Sistema de diseño desde logo (tokens, tipografía, dirección editorial) | 🔴 Alto | 4 | 1 |
| **P2** | Flujo de reserva 3 pasos + `BookingEngineAdapter` formal + recuperación de disponibilidad | 🔴 Alto | 4 | 3 |
| **P2** | Home orientado a conversión (reestructura de bloques) | 🔴 Alto | 3 | 2 |
| **P2** | Sección Huasteca/destino (captura búsqueda de destino) | 🟠 Medio | 2 | 2 |
| **P3** | Backend: zod server-side, rate-limit, honeypot, esquema de temporadas, logging de embudo | 🟠 Medio | 3 | 4 |
| **P3** | SEO/Schema completo + reconciliar rating (4.5/122) + perf (`deviceSizes`, medición) | 🟠 Medio | 3 | 5 |
| **P3** | Analytics de embudo (GA4/Plausible desactivable) | 🟠 Medio | 2 | 5 |
| **P4** | QA final: build limpio, prueba manual 375/1440, Lighthouse ≥ 90, CHANGELOG + PENDIENTES | 🔴 Alto | 2 | 6 |

---

## 8. Datos por confirmar con el dueño (no inventar — ver PENDIENTES.md)

1. **Tarifas reales** por categoría (hoy `$850` sencilla / `$1,200` doble = placeholder).
2. **Rating público:** ¿usamos 4.5/122 (Google) o 5.0/8 (reseñas confirmadas)? Deben ser coherentes.
3. **Fotos profesionales** del hotel (hoy stock).
4. **NAP definitivo:** tel/WhatsApp, correo, dirección, coordenadas.
5. **Políticas exactas:** check-in/out, mascotas, cancelación (72 h ya está).
6. **GA4 / medición** (ID) y proveedor de correo transaccional (Resend vs Brevo).
