import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { generateOrderNumber } from "@/lib/validators";
import { recordActivity } from "@/lib/activity";

type CartLine = { sku_produk_id: number | null; artikel_id: number | null; qty: number };
type SkuProductRow = { id: number; sku: string; nama_produk: string; harga_satuan: number; status: string };
type ArtikelRow = { id: number; kode_artikel: string | null; nama_artikel: string; harga_jual: number | null; status: string };

// Public, unauthenticated: this is the submit handler for the customer-facing
// order form at /order-form (the "Buat Form Pemesanan" equivalent). No OTP
// verification here — unlike the reference flow, GUDARA doesn't have an
// SMS/WhatsApp gateway configured, so orders land as status "baru" for
// admin_operasional to confirm by contacting the buyer directly. See the note
// in /order about wiring up a real OTP step later if that's needed.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const buyerNama = typeof body.buyer_nama === "string" ? body.buyer_nama.trim() : "";
  const buyerTelepon = typeof body.buyer_telepon === "string" ? body.buyer_telepon.trim() : "";
  const buyerAlamat = typeof body.buyer_alamat === "string" ? body.buyer_alamat.trim() : "";
  const catatan = typeof body.catatan === "string" ? body.catatan.trim() : "";
  const items: CartLine[] = Array.isArray(body.items)
    ? body.items
        .map((item: { sku_produk_id?: unknown; artikel_id?: unknown; qty?: unknown }) => {
          const skuId = Number(item.sku_produk_id);
          const artikelId = Number(item.artikel_id);
          return {
            sku_produk_id: Number.isInteger(skuId) && skuId > 0 ? skuId : null,
            artikel_id: Number.isInteger(artikelId) && artikelId > 0 ? artikelId : null,
            qty: Number(item.qty),
          };
        })
        .filter((item: CartLine) => (item.sku_produk_id !== null || item.artikel_id !== null) && Number.isInteger(item.qty) && item.qty > 0)
    : [];

  if (!buyerNama) {
    return NextResponse.json({ error: "Nama pembeli wajib diisi" }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "Pilih minimal 1 produk" }, { status: 400 });
  }

  try {
    const db = getDB();

    // Never trust client-supplied prices - re-fetch each SKU/artikel
    // server-side and snapshot the current name/SKU/price at order time.
    const productIds = [...new Set(items.map((item) => item.sku_produk_id).filter((v): v is number => v !== null))];
    const artikelIds = [...new Set(items.map((item) => item.artikel_id).filter((v): v is number => v !== null))];

    const productById = new Map<number, SkuProductRow>();
    if (productIds.length > 0) {
      const placeholders = productIds.map((_, i) => `?${i + 1}`).join(",");
      const { results: products } = await db
        .prepare(`SELECT id, sku, nama_produk, harga_satuan, status FROM sku_products WHERE id IN (${placeholders})`)
        .bind(...productIds)
        .all<SkuProductRow>();
      (products ?? []).forEach((p) => productById.set(p.id, p));
    }

    // Artikel dari Database Artikel dijual ke customer pakai harga_jual,
    // BUKAN harga_satuan (itu ongkos jasa jahit, dasar hitung gaji operator
    // — lihat validate-po). Hanya artikel dengan harga_jual > 0 yang boleh
    // dipesan lewat form publik ini.
    const artikelById = new Map<number, ArtikelRow>();
    if (artikelIds.length > 0) {
      const placeholders = artikelIds.map((_, i) => `?${i + 1}`).join(",");
      const { results: artikelRows } = await db
        .prepare(`SELECT id, kode_artikel, nama_artikel, harga_jual, status FROM artikels WHERE id IN (${placeholders})`)
        .bind(...artikelIds)
        .all<ArtikelRow>();
      (artikelRows ?? []).forEach((a) => artikelById.set(a.id, a));
    }

    const lines = items
      .map((item) => {
        if (item.sku_produk_id !== null) {
          const product = productById.get(item.sku_produk_id);
          if (!product || product.status !== "aktif") return null;
          const harga = Number(product.harga_satuan);
          if (!Number.isFinite(harga) || harga <= 0) return null;
          return {
            artikel_id: null as number | null,
            sku_produk_id: product.id,
            sku_produk_sku: product.sku as string | null,
            nama_artikel: `${product.nama_produk} (${product.sku})`,
            harga_satuan: harga,
            qty: item.qty,
            subtotal: harga * item.qty,
          };
        }
        if (item.artikel_id !== null) {
          const artikel = artikelById.get(item.artikel_id);
          if (!artikel || artikel.status !== "aktif") return null;
          const harga = Number(artikel.harga_jual);
          if (!Number.isFinite(harga) || harga <= 0) return null;
          return {
            artikel_id: artikel.id,
            sku_produk_id: null,
            sku_produk_sku: null,
            nama_artikel: artikel.kode_artikel ? `${artikel.nama_artikel} (${artikel.kode_artikel})` : artikel.nama_artikel,
            harga_satuan: harga,
            qty: item.qty,
            subtotal: harga * item.qty,
          };
        }
        return null;
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    if (lines.length === 0) {
      return NextResponse.json({ error: "Produk yang dipilih tidak lagi tersedia" }, { status: 400 });
    }

    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    const countRow = await db.prepare(`SELECT COUNT(*) as count FROM orders`).first<{ count: number }>();
    const nomorOrder = generateOrderNumber((countRow?.count ?? 0) + 1);

    const order = await db
      .prepare(
        `INSERT INTO orders (nomor_order, status, buyer_nama, buyer_telepon, buyer_alamat, catatan, subtotal)
         VALUES (?1, 'baru', ?2, ?3, ?4, ?5, ?6)
         RETURNING id, nomor_order`
      )
      .bind(nomorOrder, buyerNama, buyerTelepon || null, buyerAlamat || null, catatan || null, subtotal)
      .first<{ id: number; nomor_order: string }>();

    if (!order) throw new Error("Gagal membuat order");

    await db.batch(
      lines.map((line) =>
        db
          .prepare(
            `INSERT INTO order_items (order_id, artikel_id, sku_produk_id, sku_produk_sku, nama_artikel, harga_satuan, qty, subtotal)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
          )
          .bind(order.id, line.artikel_id, line.sku_produk_id, line.sku_produk_sku, line.nama_artikel, line.harga_satuan, line.qty, line.subtotal)
      )
    );

    await recordActivity({
      entity: "order",
      entityId: order.id,
      action: "order_submitted",
      summary: `Order baru ${order.nomor_order} dari ${buyerNama} (${lines.length} item)`,
    }).catch(() => {
      // Activity logging is best-effort; never fail the order over it.
    });

    return NextResponse.json({ ok: true, nomor_order: order.nomor_order }, { status: 201 });
  } catch (err) {
    console.error("POST /api/public/order failed", err);
    return NextResponse.json({ error: "Gagal mengirim pesanan, coba lagi" }, { status: 500 });
  }
}
