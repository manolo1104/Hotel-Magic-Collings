// El puente debe reconocer los comandos igual que el sitio (lib/bot/admin.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pareceComando } from '../comandos.js';

test('reconoce los comandos de Gersay', () => {
  assert.equal(pareceComando('confirmar MC-7K2P 4821'), true);
  assert.equal(pareceComando('Cancelar mc-7k2p 4821'), true);
  assert.equal(pareceComando('pausar 481 123 4567 4821'), true);
  assert.equal(pareceComando('continuar 5214811234567 4821'), true);
});

test('una plática normal NO es comando', () => {
  assert.equal(pareceComando('quiero confirmar mi reserva para 2 personas'), false);
  assert.equal(pareceComando('confirmar MC-7K2P'), false);
  assert.equal(pareceComando('hola'), false);
});

test('las expresiones son las mismas que en el sitio', () => {
  const sitio = readFileSync(new URL('../../lib/bot/admin.ts', import.meta.url), 'utf8');
  const puente = readFileSync(new URL('../comandos.js', import.meta.url), 'utf8');
  const regex = (s) => [...s.matchAll(/\/\^\\s\*\((?:confirmar|pausar)[^\n]*?\$\/i/g)].map((m) => m[0]);
  assert.deepEqual(regex(puente), regex(sitio));
  assert.equal(regex(puente).length, 2);
});
