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
        <h1 className="font-heading text-2xl font-semibold">Panel no configurado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Falta definir <code>ADMIN_PASSWORD</code> y{" "}
          <code>ADMIN_SESSION_SECRET</code> en las variables de entorno.
        </p>
      </div>
    );
  }
  if (!(await sesionActiva())) redirect("/admin/login");

  return (
    <div className="min-h-dvh bg-secondary/20">
      <AdminSidebar />
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
