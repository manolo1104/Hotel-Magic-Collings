"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  async function salir() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <Button variant="secondary" size="sm" className="gap-1.5" onClick={salir}>
      <LogOut className="size-4" aria-hidden /> Salir
    </Button>
  );
}
