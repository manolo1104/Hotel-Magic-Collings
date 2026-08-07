"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  async function salir() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  // Vive dentro del sidebar oscuro (verde bosque Kora): no usa el <Button> de
  // shadcn, que está pensado para superficies claras.
  return (
    <button type="button" className="k-logout" onClick={salir}>
      <LogOut className="size-4" strokeWidth={1.5} aria-hidden /> Cerrar sesión
    </button>
  );
}
