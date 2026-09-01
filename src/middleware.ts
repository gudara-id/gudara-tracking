import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/auth";

const PUBLIC_PATHS = ["/", "/reset-password", "/api/auth/login", "/api/auth/forgot-password", "/api/auth/reset-password"];

function homeForRole(role: SessionPayload["role"]) {
  switch (role) {
    case "admin_operasional":
      return "/produksi";
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
    ["/produksi", "admin_operasional"],
    ["/analitik", "admin_operasional"],
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
  // (admin_operasional). Role lain tidak relevan/tidak boleh akses.
  if (pathname.startsWith("/payroll") && session.role !== "admin_operasional") {
    return NextResponse.redirect(new URL(homeForRole(session.role), req.url));
  }

  // Order (dashboard penjualan/order customer): khusus role sales.
  if (pathname.startsWith("/order") && session.role !== "sales") {
    return NextResponse.redirect(new URL(homeForRole(session.role), req.url));
  }

  // Konfigurasi: admin_operasional (semua tab kecuali SKU Produk Order) + sales
  // (hanya tab SKU Produk Order, difilter di halaman/komponennya).
  if (pathname.startsWith("/konfigurasi") && !["admin_operasional", "sales"].includes(session.role)) {
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
