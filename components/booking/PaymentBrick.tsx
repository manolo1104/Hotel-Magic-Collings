"use client";

import { useEffect, useState } from "react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";

let mpInited = false;

/**
 * Formulario de pago EMBEBIDO de Mercado Pago (Payment Brick).
 * El cliente paga sin salir del sitio; los datos de tarjeta los maneja el
 * Brick y nunca tocan nuestro servidor (se convierten en un token de un uso).
 * `onPay` recibe el formData (token) y debe procesar el cobro en el backend;
 * resuelve si todo bien (éxito/pendiente) y lanza si el pago se rechaza.
 */
export function PaymentBrick({
  publicKey,
  amount,
  email,
  onPay,
}: {
  publicKey: string;
  amount: number;
  email?: string;
  onPay: (formData: unknown) => Promise<void>;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mpInited && publicKey) {
      initMercadoPago(publicKey, { locale: "es-MX" });
      mpInited = true;
    }
    setReady(true);
  }, [publicKey]);

  if (!publicKey) {
    return (
      <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Falta configurar la llave pública de Mercado Pago.
      </p>
    );
  }
  if (!ready) {
    return <div className="text-sm text-muted-foreground">Cargando el pago seguro…</div>;
  }

  return (
    <Payment
      initialization={{ amount, payer: email ? { email } : undefined }}
      customization={{
        paymentMethods: { creditCard: "all", debitCard: "all" },
      }}
      onSubmit={async ({ formData }) => {
        await onPay(formData);
      }}
      onError={(error) => {
        console.error("Payment Brick error:", error);
      }}
    />
  );
}
