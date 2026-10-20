/**
 * comandos.js — ¿el texto es un comando de Gersay? ("confirmar MC-7K2P 1234")
 * La MISMA regla que pareceComando() de lib/bot/admin.ts en el sitio: si
 * cambia una, cambia la otra (lo cuida pruebas/comandos.test.js).
 */
const PARECE_COMANDO = [
  /^\s*(confirmar|cancelar|pausar|continuar)\s+\S+\s+\d{4,8}\s*$/i,
  /^\s*(pausar|continuar)\s+[+\d][\d\s-]{9,16}\s+\d{4,8}\s*$/i,
];

export function pareceComando(texto) {
  return PARECE_COMANDO.some((r) => r.test(String(texto ?? '')));
}
