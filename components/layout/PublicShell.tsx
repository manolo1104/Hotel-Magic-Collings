"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";

/**
 * Envoltura del sitio público. En /admin se omite todo el "chrome" público
 * (navbar, footer, botón de WhatsApp): el panel tiene su propia navegación.
 * El footer llega ya renderizado en el servidor vía prop y solo se muestra
 * fuera de /admin.
 */
export function PublicShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <>
      {!isAdmin && <Navbar />}
      <main id="contenido" className="flex flex-1 flex-col">
        {children}
      </main>
      {!isAdmin && footer}
      {!isAdmin && <WhatsAppFloat />}
    </>
  );
}
