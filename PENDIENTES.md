# PENDIENTES — Magic Collinn

Lo que quedó fuera del alcance de este rediseño, con recomendación de prioridad.

---

## 1. Datos reales del dueño — `[CONFIRMAR CON DUEÑO]`  (prioridad ALTA)
Sin estos, el sitio topa en "muy bueno"; con ellos llega a "de revista".

- **Tarifas reales** por noche. Hoy: `$850` sencilla / `$1,200` doble (placeholder
  en `lib/db/seed-data.ts`). El sitio ya está listo; solo falta el número real.
- **Fotos profesionales** de las habitaciones y áreas. Hoy son fotos de celular
  (reales, en `public/imagenes/`). Una sesión pro elevaría todo el sitio.
- **GA_ID** (`NEXT_PUBLIC_GA_ID=G-XXXX`) para encender la medición de reservas.
- Confirmar **política de mascotas / horarios** si algo cambió (hoy: check-in 15:00,
  check-out 12:00, sin mascotas, cancelación 72 h — ya cargados).

## 2. Publicar el trabajo de backend guardado  (prioridad ALTA)
- La rama **`backend-pendiente`** tiene los "24 arreglos" de seguridad/reservas + el
  **pago embebido de Mercado Pago (Bricks)**, ya probados pero sin publicar.
- Falta: credenciales de **producción** de Mercado Pago para activarlo. Cuando estén,
  se publica esa rama y se junta con el rediseño.

## 3. Backend diferido de la Fase 4  (prioridad MEDIA)
Se dejaron fuera del rediseño para no chocar con `backend-pendiente`:
- **Validación zod** server-side en los endpoints públicos.
- **Rate-limit** en los endpoints de reserva.
- **Esquema de temporadas** (Semana Santa, Xantolo, verano, puentes) en tarifas.
Recomendación: hacerlos al reconciliar las dos ramas, en la capa de backend.

## 4. Medición de embudo completa  (prioridad MEDIA)
- Ya hay scaffold (`lib/track.ts`, desactivable) y 1 evento cableado (`whatsapp_click`).
- Faltan por cablear: `view_room`, `begin_booking`, `add_dates`, `submit_reservation`.
  (Requiere GA_ID configurado para verlos.)

## 5. Contenido / detalles  (prioridad BAJA)
- **Portadas del blog:** algunas son stock genérico (p. ej. "Qué hacer" muestra una
  villa moderna con alberca, no la Huasteca). Cambiarlas por imágenes de la región.
- **Tipografía:** se dejó la serif **Fraunces** (nueva). Si prefieres la anterior
  (Bricolage Grotesque), es un cambio de 1 línea.
- **Adapter formal de reservas (Kora):** se dejó el motor actual tal cual por
  decisión del dueño (no migrar a Kora). Si algún día se migra, conviene envolver
  el motor en una interfaz `BookingEngineAdapter` antes.

## 6. Rendimiento — subir Performance a ≥ 90  (prioridad MEDIA-ALTA)
**Lighthouse móvil (build de producción, localhost):**
`Accessibility 97 · Best Practices 100 · SEO 100 · Performance 78` (LCP 5.1 s,
CLS 0, TBT 170 ms, FCP 1.4 s).

Tres de cuatro categorías ya son de nivel. Lo único por debajo es **Performance**,
por el **LCP (5.1 s)**. Diagnóstico: **no es peso de imagen** (el hero pesa 159 KB,
ya en AVIF/WebP). Es que el **titular del hero (H1) se anima con JS** (WordsReveal /
Reveal arrancan en opacidad 0) y en móvil lento no "pinta" hasta que hidrata la
librería de animación → el LCP espera al JS.
- **Fix recomendado (1 pase enfocado):** que el contenido LCP del hero se muestre
  sin depender del JS (entrada por CSS, o render visible en SSR y animar solo como
  mejora). Es acotado pero toca la animación estrella del hero, por eso se deja como
  pase aparte para no arriesgar el look aprobado. Meta realista tras el fix: ≥ 90.
- En producción con CDN el LCP también mejora respecto a localhost.

## 7. Prueba de fuego
- Reserva real de punta a punta en producción (con el pago de Mercado Pago ya en
  modo producción).

---

### Estado del rediseño
Fases 0–6 completas y verificadas en localhost, en la rama `rediseno-clase-mundial`.
**Nada publicado** — pendiente tu aprobación para desplegar.
