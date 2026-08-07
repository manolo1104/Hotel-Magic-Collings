"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  FileText,
  TrendingUp,
  Users,
  ClipboardCheck,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import { LogoutButton } from "./LogoutButton";

// `ready: false` = sección aún no construida (se activa fase por fase).
const NAV = [
  { href: "/admin/insights", label: "Inicio", icon: LayoutDashboard, ready: true },
  { href: "/admin", label: "Reservas", icon: BookOpen, ready: true },
  { href: "/admin/calendario", label: "Calendario", icon: Calendar, ready: true },
  { href: "/admin/cotizaciones", label: "Cotizaciones", icon: FileText, ready: true },
  { href: "/admin/ingresos", label: "Ingresos", icon: TrendingUp, ready: true },
  { href: "/admin/clientes", label: "Clientes", icon: Users, ready: true },
  { href: "/admin/operaciones", label: "Operaciones", icon: ClipboardCheck, ready: true },
  // "Canales" (channel manager Beds24 + calendarios iCal de OTAs) se retiró del
  // menú el 8 ago 2026: el hotel dejó de trabajar con Booking.com, así que el
  // sitio es el único canal de venta. El backend sigue completo y DORMIDO (sin
  // BEDS24_REFRESH_TOKEN no hace nada), y la página /admin/canales sigue
  // existiendo por si se vuelve a Booking: basta con devolver esta línea.
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Barra móvil */}
      <div className="k-mobilebar">
        <span className="k-mobilebar-name">Panel · Magic Collinn</span>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="k-mobilebar-btn"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="k-overlay" onClick={() => setOpen(false)} aria-hidden />
      )}

      <aside className="k-sidebar" data-open={open}>
        <Link href="/admin" className="k-sidebar-brand" onClick={() => setOpen(false)}>
          <p className="k-sidebar-eye">Panel</p>
          <p className="k-sidebar-name">Magic Collinn</p>
        </Link>

        <nav className="k-nav">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            if (!item.ready) {
              return (
                <span key={item.href} className="k-nav-item opacity-50">
                  <Icon className="size-[18px]" strokeWidth={1.5} aria-hidden />
                  {item.label}
                  <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">
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
                data-active={active}
                className="k-nav-item"
              >
                <Icon className="size-[18px]" strokeWidth={1.5} aria-hidden />
                {item.label}
              </Link>
            );
          })}

          <p className="k-nav-group">Mi sitio</p>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="k-nav-item"
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="size-[18px]" strokeWidth={1.5} aria-hidden />
            Ver el sitio
          </a>
          <a
            href="/reservar"
            target="_blank"
            rel="noopener noreferrer"
            className="k-nav-item"
            onClick={() => setOpen(false)}
          >
            <Calendar className="size-[18px]" strokeWidth={1.5} aria-hidden />
            Ver mi motor
          </a>
        </nav>

        <div className="k-sidebar-foot">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
