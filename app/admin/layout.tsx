import type { Metadata } from "next";
import "./kora.css";

// Fuerza render dinámico en TODO /admin (incluido /admin/login). Así el
// PublicShell del layout raíz —que detecta /admin por pathname para ocultar
// el navbar/footer público— funciona también en el login (que de otro modo se
// prerenderiza estático y mostraría el navbar).
export const dynamic = "force-dynamic";

// Todo el panel fuera de los buscadores (cubre /admin/login, que es client
// component y no puede exportar metadata por sí solo).
export const metadata: Metadata = { robots: { index: false, follow: false } };

// `panel-kora` es el ámbito del tema del panel: dentro de esta clase los tokens
// de marca valen Kora (verde bosque, Plus Jakarta Sans, fondo #FAFAF8). Fuera de
// /admin el sitio conserva íntegra su paleta "Garza & Río". Se aplica aquí —y no
// en (panel)— para que el login herede el mismo tema.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="panel-kora flex min-h-full flex-1 flex-col bg-background text-foreground">{children}</div>;
}
