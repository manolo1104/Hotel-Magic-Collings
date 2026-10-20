/**
 * sitio.js — cómo habla el puente con el sitio del hotel (/api/bot/*).
 *
 * El "cerebro" (Haiku, precios, cotizaciones) vive en el sitio; aquí solo se
 * mandan los mensajes y se reciben las respuestas. Todas las llamadas llevan
 * `Authorization: Bearer BOT_SECRET`.
 *
 * 🔴 SITE_URL con www: el dominio sin www responde con un 301 y fetch
 * convierte el POST en GET (le pasó a Camila de Paraíso).
 */

const SITE_URL = (process.env.SITE_URL || 'https://www.hotelmagicollinn.com').replace(/\/$/, '');
const SECRET = process.env.BOT_SECRET || '';

async function llamar(ruta, { metodo = 'GET', cuerpo, timeoutMs = 70_000 } = {}) {
  const res = await fetch(`${SITE_URL}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    redirect: 'error', // una redirección aquí es un error de configuración, no algo a seguir
    signal: AbortSignal.timeout(timeoutMs),
  });
  const tipo = res.headers.get('content-type') || '';
  if (!res.ok || !tipo.includes('application/json')) {
    const texto = await res.text().catch(() => '');
    throw new Error(`${ruta} respondió ${res.status}: ${texto.slice(0, 200)}`);
  }
  return res.json();
}

export const sitio = {
  url: SITE_URL,
  configurado: () => Boolean(SECRET),
  turno: (datos) => llamar('/api/bot/turno', { metodo: 'POST', cuerpo: datos }),
  comprobante: (datos) => llamar('/api/bot/comprobante', { metodo: 'POST', cuerpo: datos }),
  admin: (texto) => llamar('/api/bot/admin', { metodo: 'POST', cuerpo: { texto }, timeoutMs: 40_000 }),
  pausa: (chatId, minutos) => llamar('/api/bot/pausa', { metodo: 'POST', cuerpo: { chatId, minutos }, timeoutMs: 20_000 }),
  pendientes: () => llamar('/api/bot/pendientes', { timeoutMs: 30_000 }),
  salud: () => llamar('/api/bot/salud', { timeoutMs: 30_000 }),
};
