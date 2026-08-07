"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo entrar.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80dvh] w-full max-w-sm flex-col justify-center px-4 py-24">
      <div className="k-card p-8">
        <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-accent text-brand">
          <Lock className="size-5" aria-hidden />
        </div>
        <p className="mt-5 text-center text-[0.68rem] font-semibold tracking-[0.14em] uppercase text-[var(--k-sage)]">
          Magic Collinn
        </p>
        <h1 className="mt-1.5 text-center text-2xl font-semibold tracking-tight text-[var(--k-forest)]">
          Panel del hotel
        </h1>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">
          Entra con la contraseña del hotel
        </p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="h-11 w-full gap-2">
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
