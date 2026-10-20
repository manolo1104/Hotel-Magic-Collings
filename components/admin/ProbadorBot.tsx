"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CheckCircle2, FlaskConical, Loader2, Paperclip, RotateCcw, Send } from "lucide-react";

// Lo que devuelve /api/admin/bot/prueba (mismo cerebro que WhatsApp).
type Alerta = { tipo: string; texto: string };
type Accion = { herramienta: string; entrada: Record<string, unknown>; ok: boolean };
type Respuesta = {
  ok?: boolean;
  error?: string;
  respuestas?: string[];
  alertas?: Alerta[];
  acciones?: Accion[];
  aviso?: string;
};

type Linea =
  | { tipo: "huesped"; texto: string }
  | { tipo: "bot"; texto: string }
  | { tipo: "accion"; texto: string }
  | { tipo: "alerta"; texto: string }
  | { tipo: "nota"; texto: string };

const SUGERENCIAS = [
  "Hola, ¿tienen habitación para 2 personas del 16 al 18 de enero?",
  "Somos 9 personas del 6 al 8 de febrero, ¿qué opciones hay?",
  "¿Tienen lugar para el 15 de noviembre?",
  "¿Aceptan mascotas?",
  "¿Cómo llego desde Ciudad Valles?",
  "¿Incluye desayuno?",
];

function nuevoChat(oculto: boolean): string {
  const id = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^a-z0-9]/gi, "").slice(0, 14);
  return `prueba:${id}@${oculto ? "lid" : "c.us"}`;
}

/** "2027-01-16" → "16 ene" */
function corta(v: unknown): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return String(v ?? "");
  const [a, m, d] = v.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d))
    .toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" })
    .replace(/\./g, "");
}

/** Lo que hizo el bot, dicho como lo diría una persona. */
function describir(a: Accion): string {
  const e = a.entrada ?? {};
  const fallo = a.ok ? "" : " (no se pudo)";
  switch (a.herramienta) {
    case "consultar_disponibilidad":
      return `🔎 Revisó disponibilidad real: ${corta(e.checkin)} → ${corta(e.checkout)}, ${e.huespedes} personas${fallo}`;
    case "crear_cotizacion": {
      const cuartos = Array.isArray(e.habitaciones)
        ? (e.habitaciones as { slug?: string; huespedes?: number }[]).map((h) => `${h.slug} (${h.huespedes}p)`).join(" + ")
        : "";
      return `📋 Armó la cotización a nombre de ${e.nombre}: ${cuartos}${fallo}`;
    }
    case "ver_mi_reserva":
      return `👀 Revisó la reserva del huésped${fallo}`;
    case "pasar_con_persona":
      return `🙋 Pidió que lo atienda una persona: ${e.motivo ?? ""}`;
    default:
      return `⚙️ ${a.herramienta}${fallo}`;
  }
}

/** *negritas* de WhatsApp → <strong>. */
function conNegritas(t: string) {
  return t.split(/(\*[^*\n]+\*)/g).map((p, i) =>
    /^\*[^*\n]+\*$/.test(p) ? <strong key={i}>{p.slice(1, -1)}</strong> : <Fragment key={i}>{p}</Fragment>,
  );
}

/** Foto del celular → JPEG de 1600 px como máximo (WhatsApp también las comprime). */
async function aBase64(archivo: File): Promise<{ mime: string; base64: string }> {
  if (archivo.type === "application/pdf") {
    const buf = new Uint8Array(await archivo.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { mime: "application/pdf", base64: btoa(bin) };
  }
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  lienzo.getContext("2d")?.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  const url = lienzo.toDataURL("image/jpeg", 0.85);
  return { mime: "image/jpeg", base64: url.slice(url.indexOf(",") + 1) };
}

export function ProbadorBot() {
  const [oculto, setOculto] = useState(false);
  const [chatId, setChatId] = useState(() => nuevoChat(false));
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [texto, setTexto] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [hayCotizacion, setHayCotizacion] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const archivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lineas, esperando]);

  function reiniciar(nuevoOculto = oculto) {
    setChatId(nuevoChat(nuevoOculto));
    setLineas([]);
    setHayCotizacion(false);
  }

  async function llamar(cuerpo: Record<string, unknown>, enviado?: Linea) {
    if (enviado) setLineas((l) => [...l, enviado]);
    setEsperando(true);
    try {
      const r = await fetch("/api/admin/bot/prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, ...cuerpo }),
      });
      const j = (await r.json().catch(() => ({}))) as Respuesta;
      const nuevas: Linea[] = [];
      if (!r.ok && j.error) nuevas.push({ tipo: "nota", texto: `⚠️ ${j.error}` });
      for (const a of j.acciones ?? []) nuevas.push({ tipo: "accion", texto: describir(a) });
      if (j.aviso) nuevas.push({ tipo: "nota", texto: `Gersay: ${j.aviso}` });
      for (const t of j.respuestas ?? []) nuevas.push({ tipo: "bot", texto: t });
      for (const a of j.alertas ?? []) nuevas.push({ tipo: "alerta", texto: a.texto });
      if ((j.acciones ?? []).some((a) => a.herramienta === "crear_cotizacion" && a.ok)) setHayCotizacion(true);
      setLineas((l) => [...l, ...nuevas]);
    } catch {
      setLineas((l) => [...l, { tipo: "nota", texto: "⚠️ Sin conexión. Intenta de nuevo." }]);
    } finally {
      setEsperando(false);
    }
  }

  function enviar(t = texto) {
    const limpio = t.trim();
    if (!limpio || esperando) return;
    setTexto("");
    void llamar({ accion: "mensaje", texto: limpio }, { tipo: "huesped", texto: limpio });
  }

  async function mandarArchivo(f: File | undefined) {
    if (!f) return;
    try {
      const { mime, base64 } = await aBase64(f);
      void llamar({ accion: "comprobante", mime, base64 }, { tipo: "huesped", texto: `📎 ${f.name}` });
    } catch {
      setLineas((l) => [...l, { tipo: "nota", texto: "⚠️ No se pudo leer ese archivo." }]);
    }
  }

  return (
    <section className="k-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-5">
        <div>
          <h2 className="k-section-title">
            <FlaskConical className="size-4" />
            Probar el bot
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Escribe como si fueras un huésped. Contesta igual que en WhatsApp —misma IA, precios y
            disponibilidad reales— pero <strong>no aparta cuartos ni le avisa a nadie</strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={oculto}
              onChange={(e) => {
                setOculto(e.target.checked);
                reiniciar(e.target.checked);
              }}
            />
            Número oculto
          </label>
          <button className="k-chip" onClick={() => reiniciar()} disabled={esperando}>
            <RotateCcw className="size-3.5" /> Nueva plática
          </button>
        </div>
      </div>

      <div className="grid max-h-[560px] min-h-[260px] content-start gap-2 overflow-y-auto bg-[#efeae2] p-3 sm:p-4">
        {lineas.length === 0 && (
          <div className="grid gap-2 py-4">
            <p className="text-center text-sm text-muted-foreground">Prueba con alguna de estas:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGERENCIAS.map((s) => (
                <button key={s} className="k-chip bg-white" onClick={() => enviar(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {lineas.map((l, i) => {
          if (l.tipo === "huesped")
            return (
              <p key={i} className="max-w-[85%] justify-self-end whitespace-pre-wrap rounded-lg bg-[#d9fdd3] px-3 py-2 text-sm shadow-sm">
                {l.texto}
              </p>
            );
          if (l.tipo === "bot")
            return (
              <p key={i} className="max-w-[85%] justify-self-start whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                {conNegritas(l.texto)}
              </p>
            );
          if (l.tipo === "accion")
            return (
              <p key={i} className="justify-self-center rounded-full bg-white/70 px-3 py-1 text-[11px] text-muted-foreground">
                {l.texto}
              </p>
            );
          if (l.tipo === "alerta")
            return (
              <div key={i} className="max-w-[92%] justify-self-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs">
                <p className="mb-1 font-semibold text-amber-800">🔔 Esto le llegaría a Gersay por WhatsApp (en la prueba no se manda):</p>
                <p className="whitespace-pre-wrap text-amber-900">{conNegritas(l.texto)}</p>
              </div>
            );
          return (
            <p key={i} className="justify-self-center text-xs text-muted-foreground">
              {l.texto}
            </p>
          );
        })}
        {esperando && (
          <p className="flex items-center gap-2 justify-self-start rounded-lg bg-white px-3 py-2 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="size-3.5 animate-spin" /> escribiendo…
          </p>
        )}
        <div ref={fin} />
      </div>

      <div className="grid gap-2 border-t p-3 sm:p-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={1}
            placeholder="Escribe como huésped…"
            aria-label="Mensaje de prueba"
            className="min-h-10 flex-1 resize-none rounded-lg border bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={esperando || !texto.trim()}
            aria-label="Enviar"
            className="flex size-10 items-center justify-center rounded-full bg-[var(--k-forest)] text-white disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          <input
            ref={archivo}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              void mandarArchivo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button className="k-chip" disabled={esperando} onClick={() => archivo.current?.click()}>
            <Paperclip className="size-3.5" /> Mandar comprobante (foto o PDF)
          </button>
          <button
            className="k-chip"
            disabled={esperando || !hayCotizacion}
            title={hayCotizacion ? "" : "Primero pide una cotización en la plática"}
            onClick={() => void llamar({ accion: "confirmar" }, { tipo: "nota", texto: "Gersay confirma el pago desde el panel…" })}
          >
            <CheckCircle2 className="size-3.5" /> Confirmar pago (como Gersay)
          </button>
        </div>
      </div>
    </section>
  );
}
