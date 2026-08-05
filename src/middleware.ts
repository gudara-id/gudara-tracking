import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

const PUBLIC_PATHS = ["/", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    const loginUrl = new URL("/", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/produksi") && session.role !== "admin_produksi") {
    return NextResponse.redirect(new URL(session.role === "operator_jahit" ? "/operator-jahit" : "/jahit", req.url));
  }

  if (pathname.startsWith("/konfigurasi") && session.role !== "admin_produksi") {
    return NextResponse.redirect(new URL(session.role === "operator_jahit" ? "/operator-jahit" : "/jahit", req.url));
  }

  if (pathname.startsWith("/jahit") && session.role !== "admin_jahit") {
    return NextResponse.redirect(new URL(session.role === "operator_jahit" ? "/operator-jahit" : "/produksi", req.url));
  }

  if (pathname.startsWith("/operator-jahit") && session.role !== "operator_jahit") {
    return NextResponse.redirect(new URL(session.role === "admin_jahit" ? "/jahit" : "/produksi", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/produksi/:path*",
    "/jahit/:path*",
    "/operator-jahit/:path*",
    "/konfigurasi/:path*",
    "/api/po/:path*",
    "/api/operator/:path*",
    "/api/setoran/:path*",
    "/api/artikel/:path*",
    "/api/users/:path*",
  ],
};
