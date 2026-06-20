// ============================================================
// PROXY (Next.js 16) — antes "middleware". Gate OPTIMISTA del panel /admin.
// Solo verifica que exista la cookie de sesión (rápido, sin validar firma).
// La verificación real de la firma se hace server-side en cada página/handler.
// ============================================================
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // El login no se protege; todo lo demás bajo /admin sí.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const cookie = request.cookies.get(ADMIN_COOKIE);
    if (!cookie?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
