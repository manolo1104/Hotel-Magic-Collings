import type { Metadata } from "next";

// Fuerza render dinámico en TODO /admin (incluido /admin/login). Así el
// PublicShell del layout raíz —que detecta /admin por pathname para ocultar
// el navbar/footer público— funciona también en el login (que de otro modo se
// prerenderiza estático y mostraría el navbar).
export const dynamic = "force-dynamic";

// Todo el panel fuera de los buscadores (cubre /admin/login, que es client
// component y no puede exportar metadata por sí solo).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
