import { redirect } from "next/navigation";
import { sesionActiva, adminConfigurado } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!adminConfigurado()) {
    return (
      <div className="mx-auto max-w-md px-4 py-28 text-center">
        <h1 className="k-title">Panel no configurado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Falta definir <code>ADMIN_PASSWORD</code> y{" "}
          <code>ADMIN_SESSION_SECRET</code> en las variables de entorno.
        </p>
      </div>
    );
  }
  if (!(await sesionActiva())) redirect("/admin/login");

  return (
    <div className="k-shell">
      <AdminSidebar />
      <main className="k-content">{children}</main>
    </div>
  );
}
