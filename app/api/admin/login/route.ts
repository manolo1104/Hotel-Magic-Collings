import { NextResponse, type NextRequest } from "next/server";
import {
  adminConfigurado,
  passwordCorrecta,
  crearToken,
  ADMIN_COOKIE,
  ADMIN_MAX_AGE,
} from "@/lib/admin/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!adminConfigurado()) {
    return NextResponse.json(
      { ok: false, error: "El panel no está configurado (faltan variables)." },
      { status: 503 },
    );
  }
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  if (!passwordCorrecta(String(body?.password ?? ""))) {
    return NextResponse.json({ ok: false, error: "Contraseña incorrecta." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, crearToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // permite http://localhost en dev
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  return res;
}
