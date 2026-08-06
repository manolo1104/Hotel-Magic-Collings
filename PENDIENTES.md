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

## 8. Channel manager — sincronización con Booking.com  (prioridad ALTA)

**Contexto:** el hotel vende únicamente en Booking.com, y Booking **no ofrece
iCal**. Sin un channel manager de por medio, el sitio y Booking no se enteran
uno del otro = riesgo real de sobreventa en ambos sentidos.

### Decisión: **Beds24** (6 ago 2026)

Se descartó WuBook: no publica precios, su iCal es de **una sola dirección**
(no baja reservas ni actualiza precios), la API buena exige activar el
"Essentials Module" con costo extra, y la vieja (Wired) trae una advertencia
literal de baneo por mal uso y documentación con páginas caídas.

Beds24 cuesta **€8.40–16/mes** (publicado), incluye la **API v2 sin módulos
extra**, tiene conexión oficial de 2 vías con Booking.com y **webhooks de
reservas**, que es lo que permite dejarlo automatizado de verdad.

También se evaluó Channex.io — el más limpio técnicamente, pero cobra $130 USD/mes
de plataforma + $7 por hotel: absurdo para 6 cuartos. Sí tiene sentido si algún
día Kora quiere ofrecer channel manager a todos sus hoteles con una sola
integración.

### Hecho y probado en localhost (6 ago 2026) — SIN PUBLICAR

Todo el código está escrito, y **apagado por defecto**: sin
`BEDS24_REFRESH_TOKEN` el sitio funciona exactamente igual que hoy (la misma
degradación grácil que Mercado Pago).

- `lib/beds24/client.ts` — cliente de la API v2 (token de acceso cacheado,
  vigilancia del límite de créditos, tipos de las respuestas).
- `lib/beds24/sync.ts` — las dos direcciones.
- `app/api/beds24/webhook` — aviso instantáneo de Beds24 (secreto en la URL).
- `app/api/cron/beds24-sync` + tarea `beds24-sync` en el reloj, cada 5 min.
- `/admin/canales` — pantalla para emparejar habitaciones y ver el estado.
- `npm run beds24:conectar -- <código>` — canjea el código de invitación.
- Columnas nuevas (se crean solas con `ensureDb`): `room_types.beds24_room_id`,
  `bookings.beds24_*`, `blocks.beds24_*`, tablas `beds24_cola` y `app_state`.

**Diseño clave — reconciliación, no eventos sueltos.** Cada reserva guarda en
`beds24_estado` lo último que se logró dejar en Beds24; el estado deseado sale
de `isReservaActiva` (la misma función que decide si el cuarto está ocupado en
el sitio). Si no coinciden, se corrige. Por eso una subida fallida se reintenta
sola, sin colas ni intervención.

**Gotcha encontrado y arreglado:** el aviso inmediato y el reloj podían pisarse
sobre la misma reserva y la llamada más lenta ganaba — se llegó a **crear en
Beds24 una reserva que aquí ya estaba cancelada**, dejando la fecha cerrada en
Booking para siempre. Ahora las sincronizaciones de una misma reserva se
encolan (`enSerie` en `lib/beds24/sync.ts`).

**Verificado** contra un Beds24 falso y contra el servidor de producción real
(`npm start`): 34 comprobaciones en la primera tanda y 16 en la segunda, más el
circuito completo en vivo — una reserva de Booking entrando por webhook baja la
disponibilidad del motor (3 → 2), y una reserva hecha en el sitio se sube sola.
Typecheck, lint y build en verde.

### Falta, en orden

1. 🔴 **Tarifas reales** (ver punto 1). Un channel manager sincroniza precios:
   conectarlo con los placeholders de hoy publica precios falsos en Booking y el
   hotel queda obligado a honrarlos. **Esto bloquea encender la conexión.**
2. Gersay abre cuenta en Beds24 y conecta Booking.com desde su panel.
3. Generar el código de invitación en `beds24.com/control3.php?pagetype=apiv2`
   con los permisos `bookings`, `inventory` y `properties`, y canjearlo con
   `npm run beds24:conectar -- <código>` (caduca en minutos, un solo uso).
4. Poner en Railway `BEDS24_REFRESH_TOKEN` y `BEDS24_WEBHOOK_SECRET`.
5. En Beds24: Settings → Properties → Access → Booking webhooks, con la URL
   `https://www.hotelmagicollinn.com/api/beds24/webhook?secret=<secreto>`.
6. En `/admin/canales`, emparejar cada tipo de habitación con la de Beds24 y
   **comprobar que el número de unidades coincida en los dos lados**.
7. Prueba de fuego: una reserva de prueba en Booking y otra en el sitio.

**Advertencia que sigue vigente:** ningún channel manager elimina la sobreventa
simultánea — si entran dos reservas en el mismo minuto por lados distintos no hay
transacción compartida. Con 6 cuartos conviene no vender la última unidad en
ambos lados a la vez. Si llega a pasar, la reserva importada queda marcada con
"⚠️ SOBREVENTA" en sus notas para que el hotel la vea.

---

### Estado del rediseño
Fases 0–6 completas y verificadas en localhost, en la rama `rediseno-clase-mundial`.
**Nada publicado** — pendiente tu aprobación para desplegar.
