import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { generatePoIdentifiers } from "@/lib/validators";
import { recordActivity } from "@/lib/activity";

type OrderRowFull = {
  id: number;
  nomor_order: string;
  status: string;
  buyer_nama: string;
  catatan: string | null;
  deadline: string | null;
  nama_po: string | null;
  po_id: number | null;
  confirmed_at: string | null;
};

type OrderItemRow = {
  id: number;
  artikel_id: number | null;
  sku_produk_id: number | null;
  nama_artikel: string;
  harga_satuan: number;
  qty: number;
};

// Ini adalah langkah "validasi" yang diminta admin_operasional sebelum sebuah
// Order (baik dari form publik maupun dari "Input Order" manual) diteruskan
// jadi permintaan produksi sungguhan. Order manual selalu mendarat dengan
// status "baru" — endpoint ini yang mengubahnya jadi PurchaseOrder di board
// produksi (kanban), sekaligus menandai order tsb "diproses" dan mengunci
// po_id supaya tidak divalidasi dua kali.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin_operasional") {
    return NextResponse.json({ error: "Hanya admin produksi yang bisa memvalidasi order menjadi PO" }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!id) return NextResponse.json({ error: "ID order tidak valid" }, { status: 400 });

  try {
    const db = getDB();
    const order = await db
      .prepare(`SELECT id, nomor_order, status, buyer_nama, catatan, deadline, nama_po, po_id, confirmed_at FROM orders WHERE id = ?1`)
      .bind(id)
      .first<OrderRowFull>();
    if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });

    if (order.po_id || order.confirmed_at) {
      return NextResponse.json({ error: "Order ini sudah divalidasi sebelumnya" }, { status: 409 });
    }
    if (order.status === "dibatalkan") {
      return NextResponse.json({ error: "Order yang sudah dibatalkan tidak bisa divalidasi jadi PO" }, { status: 400 });
    }
    if (!order.nama_po || !order.nama_po.trim()) {
      return NextResponse.json({ error: "Order ini belum punya Nama PO. Lengkapi Nama PO dulu sebelum divalidasi." }, { status: 400 });
    }

    const { results: items } = await db
      .prepare(`SELECT id, artikel_id, sku_produk_id, nama_artikel, harga_satuan, qty FROM order_items WHERE order_id = ?1 ORDER BY id ASC`)
      .bind(id)
      .all<OrderItemRow>();
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Order ini tidak punya item produk" }, { status: 400 });
    }

    // ATURAN: item dengan sku_produk_id terisi = produk Ready Stock dari
    // katalog SKU, stoknya sudah tersedia sehingga TIDAK perlu masuk Board
    // Produksi. Hanya item custom (dari Database Artikel, atau ketik
    // manual — sku_produk_id kosong) yang butuh proses produksi dan
    // dijadikan baris PO di board produksi.
    const productionItems = items.filter((it) => !it.sku_produk_id);
    const readyStockItems = items.filter((it) => !!it.sku_produk_id);

    // order_items.harga_satuan untuk item dari Database Artikel adalah
    // HARGA JUAL (harga ke customer, lihat POST /api/order), bukan ongkos
    // jasa jahit. Board Produksi & payroll butuh ongkos jahit yang
    // sebenarnya (Artikel.harga_satuan), jadi ambil ulang dari master
    // Artikel di sini supaya gaji operator jahit tidak ikut kehitung pakai
    // harga jual. Item custom ketik manual (artikel_id kosong) tidak punya
    // master data, jadi tetap pakai harga yang diketik di order.
    const productionArtikelIds = [...new Set(productionItems.map((it) => it.artikel_id).filter((v): v is number => !!v))];
    const jahitHargaByArtikelId = new Map<number, number>();
    if (productionArtikelIds.length > 0) {
      const placeholders = productionArtikelIds.map((_, i) => `?${i + 1}`).join(",");
      const { results: artikelRows } = await db
        .prepare(`SELECT id, harga_satuan FROM artikels WHERE id IN (${placeholders})`)
        .bind(...productionArtikelIds)
        .all<{ id: number; harga_satuan: number }>();
      (artikelRows ?? []).forEach((a) => jahitHargaByArtikelId.set(a.id, Number(a.harga_satuan)));
    }
    const jahitHargaFor = (item: OrderItemRow) =>
      item.artikel_id && jahitHargaByArtikelId.has(item.artikel_id)
        ? jahitHargaByArtikelId.get(item.artikel_id)!
        : Number(item.harga_satuan);
    const now = new Date().toISOString();

    // Kasus A: semua item ready stock, tidak ada yang perlu diproduksi —
    // order langsung ditandai tervalidasi & siap diproses/kirim, TANPA
    // membuat PO produksi sama sekali.
    if (productionItems.length === 0) {
      await db
        .prepare(`UPDATE orders SET status = 'diproses', confirmed_by = ?1, confirmed_at = ?2 WHERE id = ?3`)
        .bind(session.userId, now, id)
        .run();

      await recordActivity({
        session,
        entity: "order",
        entityId: id,
        action: "order_validated_no_production",
        summary: `${session.nama_lengkap} memvalidasi order ${order.nomor_order} — semua produk Ready Stock (SKU), tidak dibuat PO produksi`,
      }).catch(() => {});

      const updatedOrder = await db.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first();
      return NextResponse.json({ ok: true, order: updatedOrder, po_id: null, production_required: false }, { status: 200 });
    }

    // Kasus B: ada minimal 1 item custom yang butuh produksi — hanya item
    // custom itu yang dibuat jadi baris PO di board produksi. Item Ready
    // Stock (kalau ada, order campuran) tetap dipenuhi dari stok, tidak
    // ikut masuk PO.
    // PO baru selalu mendarat di kolom pertama papan produksi (sama seperti
    // pembuatan PO manual lewat POST /api/po), supaya rename/reorder
    // tahapan tidak membuat PO baru nyasar ke nama kolom lama.
    let initialStatus = "PRINT PO TINGKING";
    try {
      const firstStage = await db.prepare(`SELECT nama FROM production_stages ORDER BY urutan ASC LIMIT 1`).first<{ nama: string }>();
      if (firstStage?.nama) initialStatus = firstStage.nama;
    } catch (err) {
      console.error("validate-po: could not read production_stages, falling back to default stage", err);
    }

    const countRow = await db.prepare(`SELECT COUNT(*) as count FROM purchase_orders`).first<{ count: number }>();
    const { nomor_po, barcode_po } = generatePoIdentifiers((countRow?.count ?? 0) + 1);

    const targetQty = productionItems.reduce((sum, it) => sum + Number(it.qty || 0), 0);
    const description = [
      `Dibuat otomatis dari Order ${order.nomor_order} (${order.buyer_nama})`,
      order.catatan ? `Catatan: ${order.catatan}` : null,
      readyStockItems.length > 0
        ? `${readyStockItems.length} item Ready Stock (SKU) dari order ini dipenuhi dari stok, tidak dimasukkan ke PO ini.`
        : null,
    ]
      .filter(Boolean)
      .join(". ");

    const createdPo = await db
      .prepare(
        `INSERT INTO purchase_orders
          (nomor_po, barcode_po, nama_po, nama_artikel, harga_satuan, target_qty, status, due_date, description, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         RETURNING id, nomor_po`
      )
      .bind(
        nomor_po,
        barcode_po,
        order.nama_po.trim(),
        productionItems[0].nama_artikel,
        jahitHargaFor(productionItems[0]),
        targetQty || null,
        initialStatus,
        order.deadline,
        description || null,
        session.userId
      )
      .first<{ id: number; nomor_po: string }>();

    if (!createdPo) throw new Error("Gagal membuat PO produksi");

    await db.batch(
      productionItems.map((item) =>
        db
          .prepare(`INSERT INTO purchase_order_articles (po_id, artikel_id, nama_artikel, harga_satuan, qty) VALUES (?1, ?2, ?3, ?4, ?5)`)
          .bind(createdPo.id, item.artikel_id, item.nama_artikel, jahitHargaFor(item), Number(item.qty))
      )
    );

    await db
      .prepare(`UPDATE orders SET po_id = ?1, status = 'diproses', confirmed_by = ?2, confirmed_at = ?3 WHERE id = ?4`)
      .bind(createdPo.id, session.userId, now, id)
      .run();

    await recordActivity({
      session,
      entity: "order",
      entityId: id,
      action: "order_validated_to_po",
      summary: `${session.nama_lengkap} memvalidasi order ${order.nomor_order} menjadi PO produksi ${createdPo.nomor_po}${
        readyStockItems.length > 0 ? ` (${readyStockItems.length} item Ready Stock dipenuhi dari stok, tidak masuk PO)` : ""
      }`,
      metadata: { po_id: createdPo.id, nomor_po: createdPo.nomor_po },
    }).catch(() => {});

    await recordActivity({
      session,
      entity: "po",
      entityId: createdPo.id,
      action: "po_created_from_order",
      summary: `PO ${createdPo.nomor_po} dibuat dari order ${order.nomor_order} (${order.buyer_nama})`,
      metadata: { order_id: id },
    }).catch(() => {});

    const updatedOrder = await db.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first();

    return NextResponse.json(
      { ok: true, order: updatedOrder, po_id: createdPo.id, nomor_po: createdPo.nomor_po, production_required: true },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/order/[id]/validate-po failed", err);
    return NextResponse.json({ error: "Gagal memvalidasi order menjadi PO" }, { status: 500 });
  }
}
