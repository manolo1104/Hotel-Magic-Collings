"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Calendar,
  FileText,
  TrendingUp,
  Users,
  ClipboardCheck,
  Globe2,
  Leaf,
  Menu,
  X,
} from "lucide-react";
import { LogoutButton } from "./LogoutButton";

// `ready: false` = sección aún no construida (se activa fase por fase).
const NAV = [
  { href: "/admin", label: "Reservas", icon: BookOpen, ready: true },
  { href: "/admin/calendario", label: "Calendario", icon: Calendar, ready: true },
  { href: "/admin/cotizaciones", label: "Cotizaciones", icon: FileText, ready: true },
  { href: "/admin/ingresos", label: "Ingresos", icon: TrendingUp, ready: true },
  { href: "/admin/clientes", label: "Clientes", icon: Users, ready: true },
  { href: "/admin/operaciones", label: "Operaciones", icon: ClipboardCheck, ready: true },
  { href: "/admin/canales", label: "Canales", icon: Globe2, ready: true },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        if (!item.ready) {
          return (
            <span
              key={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50"
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
              <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                Pronto
              </span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-brand text-brand-foreground"
                : "text-foreground/80 hover:bg-muted"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Topbar móvil */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <span className="font-heading font-semibold">Panel · Magic Collinn</span>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-border"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Overlay móvil */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-card transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <Link
            href="/admin"
            className="hidden items-center gap-2.5 border-b border-border px-5 py-5 lg:flex"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <Leaf className="size-5 text-support" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block font-heading text-lg font-semibold">Magic Collinn</span>
              <span className="block text-xs text-muted-foreground">Panel del hotel</span>
            </span>
          </Link>
          <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
            <span className="font-heading font-semibold">Menú</span>
            <button onClick={() => setOpen(false)} aria-label="Cerrar">
              <X className="size-5" />
            </button>
          </div>
          {nav}
          <div className="mt-auto border-t border-border p-3">
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
