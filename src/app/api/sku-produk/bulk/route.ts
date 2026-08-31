import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { decimalToNumber } from "@/lib/utils";

type SkuProductRow = {
  id: number;
  sku: string;
  nama_produk: string;
  harga_satuan: number;
  status: string;
  foto_url: string | null;
  createdAt: string;
};

function serialize(row: SkuProductRow) {
  return { ...row, harga_satuan: decimalToNumber(row.harga_satuan) };
}

function parseIds(body: { ids?: unknown }) {
  if (!Array.isArray(body.ids)) return [];
  return body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
}

// Bulk edit dipakai dari checkbox "pilih" di tabel SKU Produk Order (Konfigurasi).
// Mendukung ubah status (aktif/non-aktif) dan/atau harga order sekaligus untuk
// beberapa SKU yang dicentang, tanpa perlu edit satu-satu.
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ids = parseIds(body);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Pilih minimal satu SKU produk" }, { status: 400 });
  }

  const setStatus = body.status === "aktif" || body.status === "non-aktif" ? body.status : undefined;
  const setHarga =
    body.harga_satuan !== undefined && body.harga_satuan !== null && body.harga_satuan !== ""
      ? Number(body.harga_satuan)
      : undefined;
  if (setHarga !== undefined && (!Number.isFinite(setHarga) || setHarga < 0)) {
    return NextResponse.json({ error: "Harga order tidak valid" }, { status: 400 });
  }
  if (!setStatus && setHarga === undefined) {
    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim" }, { status: 400 });
  }

  const db = getDB();
  const setClauses: string[] = [];
  const bindings: (string | number)[] = [];
  let paramIndex = 1;
  if (setStatus) {
    setClauses.push(`status = ?${paramIndex}`);
    bindings.push(setStatus);
    paramIndex += 1;
  }
  if (setHarga !== undefined) {
    setClauses.push(`harga_satuan = ?${paramIndex}`);
    bindings.push(setHarga);
    paramIndex += 1;
  }

  const placeholders = ids.map(() => `?${paramIndex++}`).join(", ");
  bindings.push(...ids);

  try {
    const { results } = await db
      .prepare(`UPDATE sku_products SET ${setClauses.join(", ")} WHERE id IN (${placeholders}) RETURNING *`)
      .bind(...bindings)
      .all<SkuProductRow>();

    return NextResponse.json((results ?? []).map(serialize));
  } catch (err) {
    console.error("PATCH /api/sku-produk/bulk failed", err);
    return NextResponse.json({ error: "Gagal mengubah SKU produk terpilih" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ids = parseIds(await req.json());
  if (ids.length === 0) {
    return NextResponse.json({ error: "Pilih minimal satu SKU produk" }, { status: 400 });
  }

  const db = getDB();
  let deleted = 0;
  let deactivated = 0;
  try {
    // Coba hapus permanen dulu; SKU yang masih dipakai di order_items akan
    // gagal karena foreign key, jadi jatuh ke fallback non-aktifkan (sama
    // seperti perilaku DELETE satuan di /api/sku-produk).
    for (const id of ids) {
      try {
        const res = await db.prepare(`DELETE FROM sku_products WHERE id = ?1`).bind(id).run();
        if (res.meta?.changes) deleted += 1;
      } catch {
        await db.prepare(`UPDATE sku_products SET status = 'non-aktif' WHERE id = ?1`).bind(id).run();
        deactivated += 1;
      }
    }
    return NextResponse.json({ ok: true, deleted, deactivated });
  } catch (err) {
    console.error("DELETE /api/sku-produk/bulk failed", err);
    return NextResponse.json({ error: "Gagal menghapus SKU produk terpilih" }, { status: 400 });
  }
}
