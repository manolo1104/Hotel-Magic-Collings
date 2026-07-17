"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

// Dispara el evento de conversión al aterrizar en /reserva/exito (retorno
// de Mercado Pago). Guarda anti-duplicado por referencia en sessionStorage:
// recargar la página no vuelve a contar la conversión.
export function TrackConversion({ referencia }: { referencia: string }) {
  useEffect(() => {
    const key = `mc_conv_${referencia}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage bloqueado: registrar de todas formas
    }
    track("payment_success", { source: "redirect", referencia });
  }, [referencia]);
  return null;
}
