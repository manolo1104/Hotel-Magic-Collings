import { NextResponse, type NextRequest } from "next/server";
import { getAvailability } from "@/lib/booking/engine";

// Runtime Node (por defecto) — necesario para PGlite/Postgres.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = await getAvailability({
    checkin: sp.get("checkin") ?? "",
    checkout: sp.get("checkout") ?? "",
    huespedes: Number(sp.get("huespedes") ?? "1"),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
