"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  Power,
  ReceiptText,
  XCircle,
} from "lucide-react";
import type { CotizacionPanel, ChatPanel, DatosPanel, LineaPlatica } from "@/lib/bot/panel";
import { ProbadorBot } from "./ProbadorBot";

function mxn(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

/** "2027-01-16" → "sáb 16 ene". Se parte la cadena para no cruzar zonas horarias. */
function dia(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d))
    .toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .replace(/\./g, "");
}

function hora(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function telefono(t: string): string {
  const d = t.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : "";
}

type Accion = "confirmar" | "cancelar" | "pausar" | "continuar" | "encender" | "apagar";

export function WhatsAppClient({ datos }: { datos: DatosPanel }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  // Botones que mueven dinero o sueltan cuartos piden un segundo clic.
  const [porConfirmar, setPorConfirmar] = useState<string | null>(null);

  async function hacer(accion: Accion, objetivo = "") {
    const clave = `${accion}:${objetivo}`;
    setOcupado(clave);
    setAviso(null);
    try {
      const r = await fetch("/api/admin/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, objetivo }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; respuesta?: string; error?: string };
      setAviso({ ok: Boolean(j.ok), texto: j.respuesta ?? j.error ?? "No se pudo." });
      router.refresh();
    } catch {
      setAviso({ ok: false, texto: "Sin conexión. Intenta de nuevo." });
    } finally {
      setOcupado(null);
      setPorConfirmar(null);
    }
  }

  function dobleClic(clave: string, accion: () => void) {
    if (porConfirmar === clave) accion();
    else setPorConfirmar(clave);
  }

  const { estado } = datos;
  const faltantes = [
    !estado.datosBancarios && "faltan los datos bancarios (las cotizaciones no dicen a dónde transferir)",
    !estado.pin && "falta el PIN para confirmar desde WhatsApp",
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-6">
      {/* ── Estado ───────────────────────────────────────── */}
      <section className="k-card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-10 items-center justify-center rounded-full ${
              estado.activo && estado.conectado
                ? "bg-support/12 text-support"
                : estado.activo
                  ? "bg-amber-500/15 text-amber-700"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            <MessageCircle className="size-5" />
          </span>
          <div>
            <p className="font-medium">
              {!estado.activo
                ? "El bot está apagado"
                : estado.conectado
                  ? "El bot está contestando"
                  : "El WhatsApp del hotel todavía no está conectado"}
            </p>
            <p className="text-sm text-muted-foreground">
              {!estado.activo
                ? "Nadie recibe respuesta automática: contesta todo a mano."
                : estado.conectado
                  ? "Contesta a quien no está en la agenda del teléfono del hotel."
                  : estado.vistoPorUltimaVez
                    ? `Se perdió la conexión (última señal: ${hora(estado.vistoPorUltimaVez)}). Mientras tanto nadie recibe respuesta automática.`
                    : "Mientras no se vincule el teléfono, el bot no contesta a nadie. Puedes probarlo aquí abajo."}
            </p>
          </div>
        </div>
        <button
          className="k-chip"
          disabled={ocupado !== null}
          onClick={() =>
            estado.activo
              ? dobleClic("apagar", () => hacer("apagar"))
              : hacer("encender")
          }
        >
          {ocupado === "apagar:" || ocupado === "encender:" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Power className="size-3.5" />
          )}
          {estado.activo ? (porConfirmar === "apagar" ? "¿Seguro? Apagar" : "Apagar") : "Encender"}
        </button>
        {faltantes.length > 0 && (
          <p className="w-full rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
            ⚠️ Para que funcione completo: {faltantes.join("; ")}.
          </p>
        )}
      </section>

      <ProbadorBot />

      {aviso && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            aviso.ok ? "bg-support/12 text-support" : "bg-destructive/10 text-destructive"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {/* ── Pagos por confirmar ──────────────────────────── */}
      <Seccion
        titulo="Pagos por confirmar"
        icono={<ReceiptText className="size-4" />}
        vacio="Ningún comprobante esperando. Cuando un huésped mande el suyo, aparece aquí y te llega aviso por WhatsApp."
        items={datos.porConfirmar}
        render={(c) => (
          <TarjetaCotizacion key={c.folio} c={c}>
            {c.comprobanteNota && (
              <p className="mt-2 text-sm">
                <span className="text-muted-foreground">Lo que se lee en el comprobante: </span>
                {c.comprobanteNota}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Confirma solo cuando veas el dinero en la cuenta. Al confirmar, el huésped recibe su
              confirmación por WhatsApp.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="k-chip !border-support !text-support"
                disabled={ocupado !== null}
                onClick={() => dobleClic(`confirmar:${c.folio}`, () => hacer("confirmar", c.folio))}
              >
                {ocupado === `confirmar:${c.folio}` ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {porConfirmar === `confirmar:${c.folio}` ? `¿Ya está el dinero? Confirmar ${mxn(c.anticipo)}` : "Confirmar pago"}
              </button>
              <BotonCancelar c={c} ocupado={ocupado} porConfirmar={porConfirmar} dobleClic={dobleClic} hacer={hacer} />
            </div>
          </TarjetaCotizacion>
        )}
      />

      {/* ── Apartadas ────────────────────────────────────── */}
      <Seccion
        titulo="Apartadas, esperando transferencia"
        icono={<Clock className="size-4" />}
        vacio="No hay cuartos apartados por el bot ahora mismo."
        items={datos.apartadas}
        render={(c) => (
          <TarjetaCotizacion key={c.folio} c={c}>
            <p className="mt-2 text-sm text-muted-foreground">Apartado hasta: {hora(c.apartadoHasta)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <BotonCancelar c={c} ocupado={ocupado} porConfirmar={porConfirmar} dobleClic={dobleClic} hacer={hacer} />
            </div>
          </TarjetaCotizacion>
        )}
      />

      {/* ── Pláticas ─────────────────────────────────────── */}
      <Seccion
        titulo="Pláticas recientes"
        icono={<MessageCircle className="size-4" />}
        vacio="Todavía no hay pláticas con el bot."
        items={datos.chats}
        render={(ch) => <TarjetaChat key={ch.chatId} ch={ch} ocupado={ocupado} hacer={hacer} />}
      />

      {/* ── Confirmadas ──────────────────────────────────── */}
      {datos.confirmadas.length > 0 && (
        <Seccion
          titulo="Confirmadas recientes"
          icono={<CheckCircle2 className="size-4" />}
          vacio=""
          items={datos.confirmadas}
          render={(c) => <TarjetaCotizacion key={c.folio} c={c} />}
        />
      )}
    </div>
  );
}

function Seccion<T>({
  titulo,
  icono,
  vacio,
  items,
  render,
}: {
  titulo: string;
  icono: React.ReactNode;
  vacio: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  return (
    <section className="grid content-start gap-3">
      <h2 className="k-section-title">
        {icono}
        {titulo}
        {items.length > 0 && <span className="k-badge bg-muted text-muted-foreground">{items.length}</span>}
      </h2>
      {items.length === 0 ? <p className="k-empty">{vacio}</p> : items.map(render)}
    </section>
  );
}

const ETIQUETA: Record<string, { t: string; c: string }> = {
  comprobante: { t: "Comprobante recibido", c: "bg-amber-500/15 text-amber-700" },
  vigente: { t: "Apartada", c: "bg-brand/10 text-brand" },
  confirmada: { t: "Confirmada", c: "bg-support/12 text-support" },
};

function TarjetaCotizacion({ c, children }: { c: CotizacionPanel; children?: React.ReactNode }) {
  const tel = telefono(c.telefono);
  const et = ETIQUETA[c.estado];
  return (
    <article className="k-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{c.nombre}</h3>
            <span className="font-mono text-xs text-muted-foreground">{c.folio}</span>
            {et && <span className={`k-badge ${et.c}`}>{et.t}</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {dia(c.checkin)} → {dia(c.checkout)} · {c.noches} {c.noches === 1 ? "noche" : "noches"} · {c.huespedes}{" "}
            {c.huespedes === 1 ? "persona" : "personas"}
          </p>
          <p className="text-sm text-muted-foreground">{c.cuartos.join(" · ")}</p>
          {tel && (
            <a
              href={`https://wa.me/52${c.telefono.replace(/\D/g, "").slice(-10)}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand underline-offset-2 hover:underline"
            >
              {tel}
            </a>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{mxn(c.total)}</p>
          <p className="text-xs text-muted-foreground">
            Anticipo {mxn(c.anticipo)}
            {c.saldo > 0 ? ` · resta ${mxn(c.saldo)}` : ""}
          </p>
        </div>
      </div>
      {children}
    </article>
  );
}

function BotonCancelar({
  c,
  ocupado,
  porConfirmar,
  dobleClic,
  hacer,
}: {
  c: CotizacionPanel;
  ocupado: string | null;
  porConfirmar: string | null;
  dobleClic: (clave: string, accion: () => void) => void;
  hacer: (accion: Accion, objetivo?: string) => void;
}) {
  const clave = `cancelar:${c.folio}`;
  return (
    <button
      className="k-chip hover:!border-destructive hover:!text-destructive"
      disabled={ocupado !== null}
      onClick={() => dobleClic(clave, () => hacer("cancelar", c.folio))}
    >
      {ocupado === clave ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
      {porConfirmar === clave ? "¿Soltar los cuartos? Cancelar" : "Cancelar apartado"}
    </button>
  );
}

function TarjetaChat({
  ch,
  ocupado,
  hacer,
}: {
  ch: ChatPanel;
  ocupado: string | null;
  hacer: (accion: Accion, objetivo?: string) => void;
}) {
  const [lineas, setLineas] = useState<LineaPlatica[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const tel = telefono(ch.telefono);

  async function verPlatica() {
    if (lineas) {
      setLineas(null);
      return;
    }
    setCargando(true);
    try {
      const r = await fetch(`/api/admin/bot?chatId=${encodeURIComponent(ch.chatId)}`);
      const j = (await r.json()) as { lineas?: LineaPlatica[] };
      setLineas(j.lineas ?? []);
    } finally {
      setCargando(false);
    }
  }

  return (
    <article className="k-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{ch.nombre || "Sin nombre"}</h3>
            {ch.pausadoHasta && (
              <span className="k-badge bg-amber-500/15 text-amber-700">
                Atiende una persona hasta {hora(ch.pausadoHasta)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {tel ? (
              <a
                href={`https://wa.me/52${ch.telefono.replace(/\D/g, "").slice(-10)}`}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                {tel}
              </a>
            ) : (
              "Número oculto por WhatsApp"
            )}{" "}
            · {hora(ch.ultimo)}
          </p>
          <p className="mt-1 text-sm">{ch.etapa}</p>
          {ch.vistaPrevia && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">«{ch.vistaPrevia}»</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="k-chip" onClick={verPlatica} disabled={cargando}>
          {cargando ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
          {lineas ? "Ocultar plática" : "Ver plática"}
        </button>
        {ch.pausadoHasta ? (
          <button className="k-chip" disabled={ocupado !== null} onClick={() => hacer("continuar", ch.chatId)}>
            <Play className="size-3.5" /> Que el bot vuelva a contestar
          </button>
        ) : (
          <button className="k-chip" disabled={ocupado !== null} onClick={() => hacer("pausar", ch.chatId)}>
            <Pause className="size-3.5" /> Callar al bot aquí (12 h)
          </button>
        )}
      </div>
      {lineas && (
        <ol className="mt-4 grid max-h-[480px] gap-2 overflow-y-auto rounded-lg bg-muted/40 p-3">
          {lineas.length === 0 && <li className="text-sm text-muted-foreground">Sin mensajes.</li>}
          {lineas.map((l, i) => (
            <li
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                l.quien === "huesped" ? "justify-self-start bg-white" : "justify-self-end bg-support/12"
              }`}
            >
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {l.quien === "huesped" ? "Huésped" : l.quien === "bot" ? "Bot" : "Hotel (automático)"} · {hora(l.en)}
              </span>
              {l.texto}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
