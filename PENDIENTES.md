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

## 6. Rendimiento — cerrar de 87 a ≥ 90  (prioridad MEDIA)
**Lighthouse móvil (build de producción, localhost):**
`Accessibility 97 · Best Practices 100 · SEO 100 · Performance 87` (CLS 0,
TBT 20 ms, FCP 1.2 s). **LCP observado real ~260 ms.**

Ya se hizo el pase de perf (78 → 87): hero con entrada CSS, ISR en home/habitaciones,
Fraunces en pesos estáticos. El **LCP observado es excelente (~260 ms)**; el número
que Lighthouse "simula" (≈4 s) es un artefacto de su modelo de 4G lento **corriendo
en `next start` local** (sin CDN ni HTTP/2 ni caché de fuente).
- **Siguiente paso real:** correr Lighthouse contra el **deploy en Vercel** (CDN +
  caché de fuente) — ahí el simulado baja y el score debería cruzar ≥ 90 sin más
  cambios. Si aún faltara, el único lever restante es reducir JS de cliente
  (framer-motion) en la ruta crítica.

## 7. Prueba de fuego
- Reserva real de punta a punta en producción (con el pago de Mercado Pago ya en
  modo producción).

---

### Estado del rediseño
Fases 0–6 completas y verificadas en localhost, en la rama `rediseno-clase-mundial`.
**Nada publicado** — pendiente tu aprobación para desplegar.
