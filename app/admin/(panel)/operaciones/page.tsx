import type { Metadata } from "next";
import { getCleaningToday, getMaintenanceTasks } from "@/lib/admin/operations";
import { getChecklistItems } from "@/lib/admin/cleaning-config";
import { OperacionesClient } from "@/components/admin/OperacionesClient";

export const metadata: Metadata = { title: "Operaciones", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OperacionesPage() {
  const hoy = new Date().toLocaleDateString("en-CA");
  const [cuartos, tareas] = await Promise.all([
    getCleaningToday(hoy),
    getMaintenanceTasks(),
  ]);
  return (
    <OperacionesClient
      hoy={hoy}
      cuartos={cuartos}
      tareas={tareas}
      items={getChecklistItems()}
    />
  );
}
