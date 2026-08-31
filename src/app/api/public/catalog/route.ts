import { NextResponse } from "next/server";
import { getDB } from "@/lib/d1";

// Public, unauthenticated: powers the customer-facing order form at
// /order-form. Only exposes active order SKU products with configured prices
// + the company name for branding.
export async function GET() {
  try {
    const db = getDB();
    const [{ results: products }, { results: artikels }, companySetting] = await Promise.all([
      db
        .prepare(
          `SELECT id, sku, nama_produk, harga_satuan, foto_url
           FROM sku_products
           WHERE status = 'aktif' AND harga_satuan > 0
           ORDER BY nama_produk ASC, sku ASC`
        )
        .all<{ id: number; sku: string; nama_produk: string; harga_satuan: number; foto_url: string | null }>(),
      // Artikel dari Database Artikel yang sudah dikasih Harga Jual (>0)
      // ikut tampil di katalog customer, berdampingan dengan SKU Produk.
      // harga_satuan (ongkos jahit) TIDAK diikutsertakan di sini.
      db
        .prepare(
          `SELECT id, kode_artikel, nama_artikel, harga_jual
           FROM artikels
           WHERE status = 'aktif' AND harga_jual > 0
           ORDER BY nama_artikel ASC`
        )
        .all<{ id: number; kode_artikel: string | null; nama_artikel: string; harga_jual: number }>(),
      db.prepare(`SELECT value FROM app_settings WHERE key = 'company_name'`).first<{ value: string }>(),
    ]);

    return NextResponse.json({
      companyName: companySetting?.value || "GUDARA",
      products: products ?? [],
      artikels: artikels ?? [],
    });
  } catch (err) {
    console.error("GET /api/public/catalog failed", err);
    return NextResponse.json({ error: "Gagal memuat katalog produk" }, { status: 500 });
  }
}
