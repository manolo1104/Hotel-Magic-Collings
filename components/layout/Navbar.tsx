"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Leaf } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";
import { EASE_DRAWER, EASE_OUT } from "@/components/motion/easing";

export function Navbar() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 8;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // A11y: Esc cierra el menú móvil y devuelve el foco a la hamburguesa
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Activo por prefijo; si dos items coinciden (p. ej. "Blog" y "Qué hacer",
  // que apunta a un post del blog), gana el href más específico.
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (!pathname.startsWith(href)) return false;
    return !site.nav.some(
      (n) => n.href.length > href.length && pathname.startsWith(n.href),
    );
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full backdrop-blur-md transition-colors duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
        scrolled
          ? "border-b border-border/70 bg-background/85 shadow-[0_1px_0_rgba(27,67,50,0.04)]"
          : "border-b border-transparent bg-background/40",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 font-heading text-lg font-semibold tracking-tight text-brand"
          aria-label={`${site.name}, inicio`}
        >
          <Leaf
            className="size-5 text-support transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-rotate-12"
            strokeWidth={1.75}
            aria-hidden
          />
          {site.name}
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {site.nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
                  active ? "text-brand" : "text-foreground/70 hover:text-brand",
                )}
              >
                {item.label}
                {active && (
                  <motion.span
                    layoutId="navIndicator"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary"
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 400, damping: 32 }
                    }
                  />
                )}
              </Link>
            );
          })}
          <Button className="ml-2 h-10 px-5" render={<Link href="/buscar" />}>
            Reservar
          </Button>
        </div>

        {/* Móvil: hamburguesa con morph */}
        <button
          type="button"
          ref={menuBtnRef}
          onClick={() => setOpen((v) => !v)}
          className="relative inline-flex size-11 items-center justify-center rounded-lg text-brand md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={open ? "x" : "menu"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -90 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, rotate: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 90 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
            >
              {open ? <X className="size-6" /> : <Menu className="size-6" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </nav>

      {/* Panel móvil */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.32, ease: EASE_DRAWER }}
            className="overflow-hidden border-t border-border/70 bg-background md:hidden"
          >
            <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-3 sm:px-6">
              {site.nav.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduce ? 0 : 0.06 + i * 0.05, ease: EASE_OUT }}
                >
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-3 text-base font-medium hover:bg-accent hover:text-brand",
                      isActive(item.href) ? "text-brand" : "text-foreground/80",
                    )}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <Button
                className="mt-2 h-12 text-base"
                render={<Link href="/buscar" />}
              >
                Reservar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
