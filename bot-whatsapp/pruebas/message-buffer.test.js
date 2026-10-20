// Pruebas de la espera por ráfaga (message-buffer.js) con reloj falso: sin WhatsApp ni red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMessageBuffer } from '../message-buffer.js';
import { createFakeClock, deferred } from './helpers/fake-clock.js';

const CHAT = '5214891234567@c.us';
const text = (t) => ({ type: 'text', text: t });

/** Buffer con reloj falso que anota cada flush (y cuántos corren a la vez). */
function setup({ onFlushImpl, ...opts } = {}) {
  const clock = createFakeClock();
  const flushes = [];
  const typing = [];
  const errors = [];
  let running = 0;
  let maxRunning = 0;
  const buffer = createMessageBuffer({
    debounceMs: 15000,
    maxWaitMs: 60000,
    typingIntervalMs: 8000,
    clock,
    onTyping: (key, meta) => typing.push({ key, at: clock.now(), meta }),
    onError: (err, key) => errors.push({ err, key }),
    onFlush: async (key, batch) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      flushes.push({ key, batch, at: clock.now() });
      try {
        if (onFlushImpl) await onFlushImpl(key, batch, flushes.length);
      } finally {
        running--;
      }
    },
    ...opts,
  });
  return { clock, buffer, flushes, typing, errors, maxRunning: () => maxRunning };
}

test('1 mensaje → flush a los 15 s y no antes', async () => {
  const { clock, buffer, flushes } = setup();
  const start = clock.now();
  buffer.push(CHAT, text('Hola'));
  assert.equal(buffer.pending(CHAT), 1);
  await clock.advance(14999);
  assert.equal(flushes.length, 0, 'contestó antes de los 15 s');
  await clock.advance(1);
  assert.equal(flushes.length, 1);
  assert.equal(flushes[0].at - start, 15000);
  assert.deepEqual(flushes[0].batch.texts, ['Hola']);
  assert.equal(buffer.pending(CHAT), 0);
  assert.equal(buffer.size(), 0);
});

test('3 mensajes a 0/5/10 s → 1 flush a los 25 s con los 3 textos en orden', async () => {
  const { clock, buffer, flushes } = setup();
  const start = clock.now();
  buffer.push(CHAT, text('Hola'));
  await clock.advance(5000);
  buffer.push(CHAT, text('somos 5'));
  await clock.advance(5000);
  buffer.push(CHAT, text('del 9 al 11'));
  await clock.advance(14999);
  assert.equal(flushes.length, 0, 'contestó a media ráfaga');
  await clock.advance(1);
  assert.equal(flushes.length, 1);
  assert.equal(flushes[0].at - start, 25000);
  const { batch } = flushes[0];
  assert.deepEqual(batch.texts, ['Hola', 'somos 5', 'del 9 al 11']);
  assert.equal(batch.count, 3);
  assert.equal(batch.firstAt, start);
  assert.equal(batch.lastAt, start + 10000);
  await clock.advance(120000);
  assert.equal(flushes.length, 1, 'hubo un flush de más');
});

test('mensaje cada 10 s → flush al tope de 60 s', async () => {
  const { clock, buffer, flushes } = setup();
  const start = clock.now();
  buffer.push(CHAT, text('m0'));
  for (let i = 1; i <= 5; i++) {
    await clock.advance(10000);
    buffer.push(CHAT, text(`m${i}`));
  }
  // t = 50 s: la ventana deslizante diría 65 s, el tope manda a los 60 s.
  await clock.advance(9999);
  assert.equal(flushes.length, 0);
  await clock.advance(1);
  assert.equal(flushes.length, 1, 'el tope no disparó');
  assert.equal(flushes[0].at - start, 60000);
  assert.deepEqual(flushes[0].batch.texts, ['m0', 'm1', 'm2', 'm3', 'm4', 'm5']);
});

test('mensaje durante onFlush → nunca dos flush a la vez y 1 flush posterior solo con lo nuevo', async () => {
  const first = deferred();
  const { clock, buffer, flushes, maxRunning } = setup({
    onFlushImpl: (key, batch, n) => (n === 1 ? first.promise : undefined),
  });
  buffer.push(CHAT, text('Hola'));
  await clock.advance(15000);
  assert.equal(flushes.length, 1);
  assert.equal(buffer.isBusy(CHAT), true);

  // Llega un mensaje mientras Camila "piensa" (y piensa mucho: su timer vence ocupado).
  await clock.advance(1000);
  buffer.push(CHAT, text('ah y somos 6'));
  await clock.advance(30000);
  assert.equal(flushes.length, 1, 'arrancó un segundo flush en paralelo');
  assert.equal(buffer.pending(CHAT), 1, 'el mensaje nuevo debía quedarse esperando');

  // Termina la primera respuesta: lo nuevo ya cumplió su espera → sale enseguida.
  first.resolve();
  await clock.advance(0);
  assert.equal(flushes.length, 2);
  assert.deepEqual(flushes[1].batch.texts, ['ah y somos 6']);
  assert.equal(maxRunning(), 1);
  await clock.advance(120000);
  assert.equal(flushes.length, 2, 'hubo más de 1 flush posterior');
  assert.equal(buffer.isBusy(CHAT), false);
});

test('mensaje durante onFlush que termina rápido → espera el resto de su ventana', async () => {
  const first = deferred();
  const { clock, buffer, flushes, maxRunning } = setup({
    onFlushImpl: (key, batch, n) => (n === 1 ? first.promise : undefined),
  });
  buffer.push(CHAT, text('Hola'));
  await clock.advance(15000);
  const busyStart = clock.now();
  await clock.advance(1000);
  buffer.push(CHAT, text('otra cosa')); // llega en t = +16 s
  await clock.advance(2000);
  first.resolve(); // la respuesta termina en t = +18 s
  await clock.advance(0);
  assert.equal(flushes.length, 1, 'no debía contestar sin esperar su ventana');
  await clock.advance(12999); // +16 s + 15 s = +31 s
  assert.equal(flushes.length, 1);
  await clock.advance(1);
  assert.equal(flushes.length, 2);
  assert.equal(flushes[1].at - busyStart, 16000);
  assert.deepEqual(flushes[1].batch.texts, ['otra cosa']);
  assert.equal(maxRunning(), 1);
});

test('meta: el último msg/chat/userName pisa, resumeNote conserva el primero no vacío', async () => {
  const { clock, buffer, flushes } = setup();
  const m1 = { id: 1 };
  const m2 = { id: 2 };
  const m3 = { id: 3 };
  buffer.push(CHAT, text('Hola'), { msg: m1, chat: 'c1', userName: 'Ana', contactNumber: '5214891234567', resumeNote: '[NOTA INTERNA: el equipo atendió]' });
  await clock.advance(2000);
  buffer.push(CHAT, text('somos 2'), { msg: m2, chat: 'c2', userName: 'Ana López', resumeNote: '' });
  await clock.advance(2000);
  buffer.push(CHAT, text('para el sábado'), { msg: m3, userName: '', resumeNote: '[OTRA NOTA]' });
  await clock.advance(15000);
  assert.equal(flushes.length, 1);
  const { meta } = flushes[0].batch;
  assert.equal(meta.resumeNote, '[NOTA INTERNA: el equipo atendió]');
  assert.equal(meta.msg, m3);
  assert.equal(meta.chat, 'c2');
  assert.equal(meta.userName, 'Ana López', 'un userName vacío no borra el anterior');
  assert.equal(meta.contactNumber, '5214891234567');
});

test('meta sin datos → trae los campos vacíos', async () => {
  const { clock, buffer, flushes } = setup();
  buffer.push(CHAT, text('Hola'));
  await clock.advance(15000);
  assert.deepEqual(flushes[0].batch.meta, { msg: null, chat: null, userName: '', contactNumber: '', resumeNote: '' });
});

test('comprobante + texto + media no soportada en el mismo batch', async () => {
  const { clock, buffer, flushes } = setup();
  const proof = { type: 'proof', folio: 'WA-ABC123', kind: 'pdf', ackText: '✅ ¡Gracias!' };
  buffer.push(CHAT, proof);
  await clock.advance(3000);
  buffer.push(CHAT, text('ya pagué'));
  buffer.push(CHAT, { type: 'unsupported_media' });
  buffer.push(CHAT, text('   ')); // vacío: se ignora
  await clock.advance(15000);
  assert.equal(flushes.length, 1);
  const { batch } = flushes[0];
  assert.equal(batch.count, 3);
  assert.deepEqual(batch.items.map(i => i.type), ['proof', 'text', 'unsupported_media']);
  assert.deepEqual(batch.texts, ['ya pagué']);
  assert.equal(batch.proofs.length, 1);
  assert.equal(batch.proofs[0].folio, 'WA-ABC123');
  assert.equal(batch.unsupported, 1);
});

test('discard borra lo pendiente y cancela el timer', async () => {
  const { clock, buffer, flushes } = setup();
  buffer.push(CHAT, text('Hola'));
  buffer.push('otro@c.us', text('Buenas'));
  await clock.advance(5000);
  assert.equal(buffer.discard(CHAT), 1);
  assert.equal(buffer.pending(CHAT), 0);
  assert.equal(buffer.size(), 1);
  await clock.advance(60000);
  assert.equal(flushes.length, 1);
  assert.equal(flushes[0].key, 'otro@c.us', 'solo debía contestar al chat no descartado');
  assert.equal(buffer.discard('nadie@c.us'), 0);
});

test('discard durante onFlush no interrumpe la respuesta en curso', async () => {
  const first = deferred();
  let finished = false;
  const { clock, buffer, flushes } = setup({
    onFlushImpl: async (key, batch, n) => { if (n === 1) { await first.promise; finished = true; } },
  });
  buffer.push(CHAT, text('Hola'));
  await clock.advance(15000);
  buffer.push(CHAT, text('otra'));
  buffer.discard(CHAT);
  first.resolve();
  await clock.advance(60000);
  assert.equal(finished, true);
  assert.equal(flushes.length, 1, 'lo descartado no debía contestarse');
  assert.equal(buffer.isBusy(CHAT), false);
});

test('typing: inmediato al empezar, cada 8 s mientras está ocupado y nunca después', async () => {
  const first = deferred();
  const { clock, buffer, typing } = setup({
    onFlushImpl: (key, batch, n) => (n === 1 ? first.promise : undefined),
  });
  buffer.push(CHAT, text('Hola'), { userName: 'Ana' });
  await clock.advance(14999);
  assert.equal(typing.length, 0, 'typing antes de empezar a responder');
  await clock.advance(1);
  assert.equal(typing.length, 1);
  assert.equal(typing[0].key, CHAT);
  assert.equal(typing[0].meta.userName, 'Ana');
  await clock.advance(8000);
  assert.equal(typing.length, 2);
  await clock.advance(8000);
  assert.equal(typing.length, 3);
  first.resolve();
  await clock.advance(0);
  await clock.advance(60000);
  assert.equal(typing.length, 3, 'siguió "escribiendo…" después de responder');
  assert.equal(clock.pendingTimers(), 0, 'quedó un timer vivo');
});

test('onFlush que lanza → onError(err, key) y se libera el candado', async () => {
  const { clock, buffer, flushes, errors } = setup({
    onFlushImpl: (key, batch, n) => { if (n === 1) throw new Error('falló Anthropic'); },
  });
  buffer.push(CHAT, text('Hola'));
  await clock.advance(15000);
  assert.equal(flushes.length, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].err.message, 'falló Anthropic');
  assert.equal(errors[0].key, CHAT);
  assert.equal(buffer.isBusy(CHAT), false, 'el candado quedó tomado');

  buffer.push(CHAT, text('¿sigues ahí?'));
  await clock.advance(15000);
  assert.equal(flushes.length, 2, 'después del error ya no contestó');
  assert.deepEqual(flushes[1].batch.texts, ['¿sigues ahí?']);
});

test('dos chats distintos no se estorban', async () => {
  const slow = deferred();
  const { clock, buffer, flushes } = setup({
    onFlushImpl: (key) => (key === 'a@c.us' ? slow.promise : undefined),
  });
  buffer.push('a@c.us', text('hola'));
  await clock.advance(1000);
  buffer.push('b@c.us', text('buenas'));
  await clock.advance(15000);
  assert.equal(flushes.length, 2);
  assert.equal(buffer.isBusy('a@c.us'), true);
  assert.equal(buffer.isBusy('b@c.us'), false);
  slow.resolve();
  await clock.advance(0);
  assert.equal(buffer.isBusy('a@c.us'), false);
});

test('sin onFlush → error claro', () => {
  assert.throws(() => createMessageBuffer({}), /onFlush/);
});
