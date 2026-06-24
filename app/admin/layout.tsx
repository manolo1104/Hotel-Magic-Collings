// Fuerza render dinámico en TODO /admin (incluido /admin/login). Así el
// PublicShell del layout raíz —que detecta /admin por pathname para ocultar
// el navbar/footer público— funciona también en el login (que de otro modo se
// prerenderiza estático y mostraría el navbar).
export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
