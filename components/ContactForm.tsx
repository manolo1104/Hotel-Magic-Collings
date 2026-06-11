"use client";

import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { site } from "@/lib/site";

// Por defecto abre el cliente de correo (mailto). Para recibir los mensajes
// en una bandeja sin abrir el correo del visitante, pega tu URL de Formspree.
const FORMSPREE_URL = ""; // TODO: URL de Formspree (ej. https://formspree.io/f/xxxx)

export function ContactForm() {
  const [form, setForm] = useState({ nombre: "", whatsapp: "", mensaje: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const reduce = useReducedMotion();

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (FORMSPREE_URL) {
      setLoading(true);
      try {
        await fetch(FORMSPREE_URL, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setSent(true);
      } finally {
        setLoading(false);
      }
      return;
    }
    // Fallback: abrir el correo con el mensaje pre-rellenado
    const subject = `Mensaje de ${form.nombre || "un huésped"} — ${site.name}`;
    const body = `Nombre: ${form.nombre}\nWhatsApp: ${form.whatsapp}\n\n${form.mensaje}`;
    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  if (sent) {
    return (
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.25 }}
        className="flex items-start gap-3 rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground"
      >
        <motion.span
          initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.4, delay: 0.1 }}
          className="text-support"
        >
          <CheckCircle2 className="size-6 shrink-0" aria-hidden />
        </motion.span>
        <span>
          Gracias por escribirnos. Te responderemos lo antes posible. Si es
          urgente, contáctanos directamente por WhatsApp.
        </span>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-5 rounded-2xl border border-border bg-card p-6 sm:p-8"
    >
      <div className="grid gap-2">
        <Label htmlFor="c-nombre">Nombre</Label>
        <Input
          id="c-nombre"
          required
          autoComplete="name"
          value={form.nombre}
          onChange={(e) => update("nombre", e.target.value)}
          placeholder="Tu nombre"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="c-whatsapp">WhatsApp</Label>
        <Input
          id="c-whatsapp"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.whatsapp}
          onChange={(e) => update("whatsapp", e.target.value)}
          placeholder="Ej. 481 123 4567"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="c-mensaje">Mensaje</Label>
        <textarea
          id="c-mensaje"
          required
          rows={4}
          value={form.mensaje}
          onChange={(e) => update("mensaje", e.target.value)}
          placeholder="¿En qué te podemos ayudar?"
          className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <Button type="submit" disabled={loading} className="h-11 gap-2">
        <Send className="size-4" aria-hidden />
        {loading ? "Enviando…" : "Enviar mensaje"}
      </Button>
    </form>
  );
}
