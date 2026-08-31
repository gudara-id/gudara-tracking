import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/validators";
import { recordActivity } from "@/lib/activity";

type OrderRow = {
  id: number;
  nomor_order: string;
  status: string;
  buyer_nama: string;
  buyer_telepon: string | null;
  buyer_alamat: string | null;
  catatan: string | null;
  subtotal: number;
  confirmed_by: number | null;
  confirmed_at: string | null;
  createdAt: string;
  item_count: number;
};

type ManualItemInput = {
  sku_produk_id?: unknown;
  artikel_id?: unknown;
  nama_artikel?: unknown;
  harga_satuan?: unknown;
  qty?: unknown;
};

type SkuProductRow = { id: number; sku: string; nama_produk: string; harga_satuan: number; status: string };
type ArtikelRow = { id: number; kode_artikel: string | null; nama_artikel: string; harga_satuan: number; harga_jual: number | null; status: string };

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "sales") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDB();
    const { results } = await db
      .prepare(
        `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
         FROM orders o
         ORDER BY o."createdAt" DESC`
      )
      .all<OrderRow>();
    return NextResponse.json(results ?? []);
  } catch (err) {
    console.error("GET /api/order failed", err);
    return NextResponse.json({ error: "Gagal memuat data order" }, { status: 500 });
  }
}

// Input Order manual: dipakai oleh tombol "Input Order" di dashboard Order
// (admin_produksi / sales mengetik langsung pesanan customer, misalnya dari
// WA/telepon, tanpa lewat form pemesanan publik). Order yang dibuat lewat
// endpoint ini selalu mendarat dengan status "baru" — SAMA seperti order
// dari form publik — jadi tetap harus divalidasi oleh admin_produksi
// (lihat POST /api/order/[id]/validate-po) sebelum diteruskan jadi PO
// sungguhan di board produksi. `nama_po` di sini hanya usulan nama PO yang
// dipakai saat validasi nanti.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "sales") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const buyerNama = typeof body.buyer_nama === "string" ? body.buyer_nama.trim() : "";
  const buyerTelepon = typeof body.buyer_telepon === "string" ? body.buyer_telepon.trim() : "";
  const buyerAlamat = typeof body.buyer_alamat === "string" ? body.buyer_alamat.trim() : "";
  const catatan = typeof body.catatan === "string" ? body.catatan.trim() : "";
  const namaPo = typeof body.nama_po === "string" ? body.nama_po.trim() : "";
  const metodePembayaran = typeof body.metode_pembayaran === "string" ? body.metode_pembayaran.trim() : "";

  const rawItems: ManualItemInput[] = Array.isArray(body.items) ? body.items : [];

  if (!buyerNama) {
    return NextResponse.json({ error: "Nama konsumen wajib diisi" }, { status: 400 });
  }
  if (!namaPo) {
    return NextResponse.json({ error: "Nama PO wajib diisi" }, { status: 400 });
  }
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Tambahkan minimal 1 produk" }, { status: 400 });
  }

  let deadlineValue: string | null = null;
  if (body.deadline) {
    const parsed = new Date(body.deadline as string);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Deadline tidak valid" }, { status: 400 });
    }
    deadlineValue = parsed.toISOString();
  }

  let dpValue = 0;
  if (body.dp_amount !== undefined && body.dp_amount !== null && body.dp_amount !== "") {
    dpValue = Number(body.dp_amount);
    if (!Number.isFinite(dpValue) || dpValue < 0) {
      return NextResponse.json({ error: "Nominal DP tidak valid" }, { status: 400 });
    }
  }

  try {
    const db = getDB();

    // Baris produk dari katalog SKU (Ready Stock — sudah tersedia stoknya,
    // TIDAK butuh proses produksi lagi) digabung dengan baris produk dari
    // Database Artikel dan baris produk custom ketik manual (keduanya
    // butuh proses produksi, lihat catatan di /api/order/[id]/validate-po).
    // Harga selalu diambil ulang dari DB, tidak dipercaya dari client.
    const skuIds = [...new Set(rawItems.map((it) => Number(it.sku_produk_id)).filter((n) => Number.isInteger(n) && n > 0))];
    const productById = new Map<number, SkuProductRow>();
    if (skuIds.length > 0) {
      const placeholders = skuIds.map((_, i) => `?${i + 1}`).join(",");
      const { results: products } = await db
        .prepare(`SELECT id, sku, nama_produk, harga_satuan, status FROM sku_products WHERE id IN (${placeholders})`)
        .bind(...skuIds)
        .all<SkuProductRow>();
      (products ?? []).forEach((p) => productById.set(p.id, p));
    }

    const artikelIds = [...new Set(rawItems.map((it) => Number(it.artikel_id)).filter((n) => Number.isInteger(n) && n > 0))];
    const artikelById = new Map<number, ArtikelRow>();
    if (artikelIds.length > 0) {
      const placeholders = artikelIds.map((_, i) => `?${i + 1}`).join(",");
      const { results: artikelRows } = await db
        .prepare(`SELECT id, kode_artikel, nama_artikel, harga_satuan, harga_jual, status FROM artikels WHERE id IN (${placeholders})`)
        .bind(...artikelIds)
        .all<ArtikelRow>();
      (artikelRows ?? []).forEach((a) => artikelById.set(a.id, a));
    }

    type Line = {
      artikel_id: number | null;
      sku_produk_id: number | null;
      sku_produk_sku: string | null;
      nama_artikel: string;
      harga_satuan: number;
      qty: number;
      subtotal: number;
    };
    const lines: Line[] = [];
    for (const raw of rawItems) {
      const qty = Number(raw.qty);
      if (!Number.isInteger(qty) || qty <= 0) continue;

      // 1) Produk Ready Stock dari katalog SKU — tidak butuh produksi.
      const skuId = Number(raw.sku_produk_id);
      if (Number.isInteger(skuId) && skuId > 0) {
        const product = productById.get(skuId);
        if (!product || product.status !== "aktif") continue;
        const harga = Number(product.harga_satuan);
        if (!Number.isFinite(harga) || harga <= 0) continue;
        lines.push({
          artikel_id: null,
          sku_produk_id: product.id,
          sku_produk_sku: product.sku,
          nama_artikel: `${product.nama_produk} (${product.sku})`,
          harga_satuan: harga,
          qty,
          subtotal: harga * qty,
        });
        continue;
      }

      // 2) Produk custom dari Database Artikel — butuh proses produksi.
      // Harga dipakai untuk order adalah harga_jual (harga ke customer),
      // BUKAN harga_satuan (itu ongkos jasa jahit, dasar hitung gaji).
      const artikelId = Number(raw.artikel_id);
      if (Number.isInteger(artikelId) && artikelId > 0) {
        const artikel = artikelById.get(artikelId);
        if (!artikel || artikel.status !== "aktif") continue;
        const harga = Number(artikel.harga_jual);
        if (!Number.isFinite(harga) || harga <= 0) continue;
        lines.push({
          artikel_id: artikel.id,
          sku_produk_id: null,
          sku_produk_sku: null,
          nama_artikel: artikel.kode_artikel ? `${artikel.nama_artikel} (${artikel.kode_artikel})` : artikel.nama_artikel,
          harga_satuan: harga,
          qty,
          subtotal: harga * qty,
        });
        continue;
      }

      // 3) Produk custom ketik manual (belum ada di Database Artikel) — butuh proses produksi.
      const namaArtikel = typeof raw.nama_artikel === "string" ? raw.nama_artikel.trim() : "";
      const harga = Number(raw.harga_satuan);
      if (!namaArtikel || !Number.isFinite(harga) || harga <= 0) continue;
      lines.push({
        artikel_id: null,
        sku_produk_id: null,
        sku_produk_sku: null,
        nama_artikel: namaArtikel,
        harga_satuan: harga,
        qty,
        subtotal: harga * qty,
      });
    }

    if (lines.length === 0) {
      return NextResponse.json({ error: "Tidak ada produk valid untuk disimpan" }, { status: 400 });
    }

    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    if (dpValue > subtotal) {
      return NextResponse.json({ error: "DP tidak boleh lebih besar dari total" }, { status: 400 });
    }

    const countRow = await db.prepare(`SELECT COUNT(*) as count FROM orders`).first<{ count: number }>();
    const nomorOrder = generateOrderNumber((countRow?.count ?? 0) + 1);

    const order = await db
      .prepare(
        `INSERT INTO orders (nomor_order, status, buyer_nama, buyer_telepon, buyer_alamat, catatan, subtotal, dp_amount, deadline, metode_pembayaran, nama_po)
         VALUES (?1, 'baru', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         RETURNING id, nomor_order`
      )
      .bind(
        nomorOrder,
        buyerNama,
        buyerTelepon || null,
        buyerAlamat || null,
        catatan || null,
        subtotal,
        dpValue,
        deadlineValue,
        metodePembayaran || null,
        namaPo
      )
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
      session,
      entity: "order",
      entityId: order.id,
      action: "order_manual_input",
      summary: `${session.nama_lengkap} input order manual ${order.nomor_order} untuk ${buyerNama} (PO: ${namaPo}) — menunggu validasi admin produksi`,
    }).catch(() => {
      // Activity logging is best-effort; never fail the order over it.
    });

    return NextResponse.json({ ok: true, id: order.id, nomor_order: order.nomor_order }, { status: 201 });
  } catch (err) {
    console.error("POST /api/order failed", err);
    return NextResponse.json({ error: "Gagal menyimpan order" }, { status: 500 });
  }
}
