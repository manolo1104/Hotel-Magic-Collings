"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GalleryPhoto {
  src: string;
  alt: string;
}

const GalleryContext = createContext<{ openAt: (i: number) => void } | null>(
  null,
);

/**
 * Lightbox de fotos: envuelve una cuadrícula con <Gallery photos={...}> y cada
 * imagen con <GalleryTile index={i}>. Base UI Dialog aporta focus trap y Esc;
 * flechas y ← → navegan (con wrap), swipe en móvil, contador y caption.
 */
export function Gallery({
  photos,
  children,
}: {
  photos: GalleryPhoto[];
  children: ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const count = photos.length;

  const openAt = useCallback((i: number) => setIndex(i), []);
  const next = useCallback(
    () => setIndex((i) => (i === null ? i : (i + 1) % count)),
    [count],
  );
  const prev = useCallback(
    () => setIndex((i) => (i === null ? i : (i - 1 + count) % count)),
    [count],
  );

  // Teclado: ← → navegan. Esc lo maneja Base UI.
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, next, prev]);

  const photo = index === null ? null : photos[index];

  return (
    <GalleryContext.Provider value={{ openAt }}>
      {children}

      <DialogPrimitive.Root
        open={index !== null}
        onOpenChange={(o) => {
          if (!o) setIndex(null);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Popup
            aria-label="Galería de fotos"
            className="fixed inset-0 z-50 flex flex-col p-4 outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 sm:p-6"
          >
            {photo && (
              <>
                {/* Barra superior: contador + cerrar */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/80">
                    {(index ?? 0) + 1} / {count}
                  </span>
                  <DialogPrimitive.Close
                    aria-label="Cerrar galería"
                    className="inline-flex size-11 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <X className="size-6" aria-hidden />
                  </DialogPrimitive.Close>
                </div>

                {/* Imagen (swipe en móvil cuando hay varias) */}
                <div className="relative flex-1 select-none">
                  <motion.div
                    key={photo.src}
                    className="absolute inset-0"
                    initial={reduce ? false : { opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    drag={count > 1 && !reduce ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.15}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -60) next();
                      else if (info.offset.x > 60) prev();
                    }}
                  >
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      sizes="100vw"
                      draggable={false}
                      className="object-contain"
                    />
                  </motion.div>

                  {count > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={prev}
                        aria-label="Foto anterior"
                        className="absolute top-1/2 left-0 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:left-2"
                      >
                        <ChevronLeft className="size-6" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={next}
                        aria-label="Foto siguiente"
                        className="absolute top-1/2 right-0 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:right-2"
                      >
                        <ChevronRight className="size-6" aria-hidden />
                      </button>
                    </>
                  )}
                </div>

                {/* Caption */}
                <p className="mt-3 text-center text-sm text-white/75">
                  {photo.alt}
                </p>
              </>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </GalleryContext.Provider>
  );
}

export function GalleryTile({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  const ctx = useContext(GalleryContext);
  return (
    <button
      type="button"
      onClick={() => ctx?.openAt(index)}
      aria-label="Ver foto en grande"
      className={cn(
        "relative block size-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
        className,
      )}
    >
      {children}
    </button>
  );
}
