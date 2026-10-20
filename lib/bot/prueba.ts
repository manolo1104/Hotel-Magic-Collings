// ============================================================
// MODO PRUEBA — el probador del panel (/admin/whatsapp)
// Una plática cuyo chatId empieza con "prueba:" corre por el MISMO cerebro,
// con la MISMA IA, precios y disponibilidad reales, pero sin efectos:
//  · no aparta cuartos (la cotización se calcula, no se crean reservas)
//  · no avisa a Gersay ni manda correos (los avisos se enseñan en pantalla)
//  · el puente nunca le manda nada (WhatsApp no da ids con ese prefijo)
//  · no aparece en las listas del panel
// ============================================================

export const PREFIJO_PRUEBA = "prueba:";

export function esChatDePrueba(chatId: string): boolean {
  return chatId.startsWith(PREFIJO_PRUEBA);
}

/** Teléfono de mentira para las pruebas con "número visible". */
export const TELEFONO_PRUEBA = "524810000000";
