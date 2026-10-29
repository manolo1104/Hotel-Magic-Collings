import type { Metadata } from "next";
import { getRoomTypes, precioPorNoche } from "@/lib/booking/engine";
import { HabitacionesClient } from "@/components/admin/HabitacionesClient";

export const metadata: Metadata = { title: "Habitaciones", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function HabitacionesPage() {
  // Las mismas habitaciones que ve el huésped en el sitio: sin el cuarto de
  // prueba, sin las categorías retiradas y sin las que no tienen cuartos.
  const tipos = await getRoomTypes();

  // Un precio por cada número de personas que cabe. Se calcula con
  // `precioPorNoche`, la misma función que cobra el motor: así la Suite (precio
  // único, `precios` vacío) sale con su precio repetido en cada fila.
  const habitaciones = tipos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    descripcion: t.descripcion,
    fotos: t.fotos,
    camas: t.camas,
    precios: Array.from({ length: t.capacidad }, (_, i) => precioPorNoche(t, i + 1)),
  }));

  return (
    <div className="w-full max-w-[1200px]">
      <header className="mb-7">
        <p className="k-eyebrow">Panel</p>
        <h1 className="k-title">Habitaciones</h1>
        <p className="k-subtitle">
          Cambia las fotos, el precio, las camas y la descripción de cada habitación. Lo
          que guardes aquí es lo que ve el huésped en el sitio
        </p>
      </header>
      <HabitacionesClient habitaciones={habitaciones} />
    </div>
  );
}
