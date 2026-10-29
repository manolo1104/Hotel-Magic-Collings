import { leerFoto } from "@/lib/booking/habitaciones";

export const runtime = "nodejs";

/**
 * Foto de habitación subida desde el panel. Público (fuera de /api, que está
 * bloqueado en robots, para que Google pueda indexarla). Cada foto tiene un id
 * nuevo y nunca cambia, así que se cachea un año en el navegador y en el CDN.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ archivo: string }> },
) {
  const { archivo } = await params;
  const foto = await leerFoto(archivo);
  if (!foto) return new Response("No existe esa foto.", { status: 404 });
  return new Response(new Uint8Array(foto.datos), {
    headers: {
      "Content-Type": foto.tipo,
      "Content-Length": String(foto.datos.length),
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
