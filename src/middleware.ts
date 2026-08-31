import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/auth";

const PUBLIC_PATHS = ["/", "/reset-password", "/api/auth/login", "/api/auth/forgot-password", "/api/auth/reset-password"];

function homeForRole(role: SessionPayload["role"]) {
  switch (role) {
    case "admin_produksi":
      return "/produksi";
    case "admin_jahit":
      return "/jahit";
    case "operator_jahit":
      return "/operator-jahit";
    case "operator_produksi":
      return "/operator-produksi";
    case "kurir":
      return "/kurir";
    case "sales":
      return "/order";
    default:
      return "/";
  }
}

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

  // Halaman-halaman berikut masing-masing hanya untuk satu role spesifik.
  const singleRolePages: [string, SessionPayload["role"]][] = [
    ["/produksi", "admin_produksi"],
    ["/konfigurasi", "admin_produksi"],
    ["/analitik", "admin_produksi"],
    ["/jahit", "admin_jahit"],
    ["/operator-jahit", "operator_jahit"],
    ["/gaji-saya", "operator_jahit"],
    ["/operator-produksi", "operator_produksi"],
    ["/kurir", "kurir"],
  ];
  for (const [prefix, requiredRole] of singleRolePages) {
    if (pathname.startsWith(prefix) && session.role !== requiredRole) {
      return NextResponse.redirect(new URL(homeForRole(session.role), req.url));
    }
  }

  // Payroll: hanya role yang memegang data setoran/upah operator jahit
  // (admin_produksi, admin_jahit). Role lain tidak relevan/tidak boleh akses.
  if (pathname.startsWith("/payroll") && !["admin_produksi", "admin_jahit"].includes(session.role)) {
    return NextResponse.redirect(new URL(homeForRole(session.role), req.url));
  }

  // Order (dashboard penjualan/order customer): admin_produksi + role sales.
  if (pathname.startsWith("/order") && !["admin_produksi", "sales"].includes(session.role)) {
    return NextResponse.redirect(new URL(homeForRole(session.role), req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/produksi/:path*",
    "/jahit/:path*",
    "/operator-jahit/:path*",
    "/operator-produksi/:path*",
    "/kurir/:path*",
    "/konfigurasi/:path*",
    "/payroll/:path*",
    "/gaji-saya/:path*",
    "/analitik/:path*",
    "/order/:path*",
    "/api/po/:path*",
    "/api/operator/:path*",
    "/api/setoran/:path*",
    "/api/artikel/:path*",
    "/api/sku-produk/:path*",
    "/api/users/:path*",
    "/api/settings/:path*",
    "/api/tahapan/:path*",
    "/api/payroll/:path*",
    "/api/analitik/:path*",
    "/api/order/:path*",
  ],
};
