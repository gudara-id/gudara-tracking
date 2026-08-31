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

// Foto disimpan sebagai data URL base64 (dikompres di browser, lihat
// image-compress.ts) langsung di kolom foto_url — sama seperti pola
// setoran_jahit.foto_url. Batasi ukurannya di sini juga sebagai jaring
// pengaman kalau ada yang mem-bypass kompresi di client.
const MAX_FOTO_DATA_URL_LENGTH = 1_500_000; // ~1.1MB foto setelah base64

function parsePayload(body: {
  sku?: unknown;
  nama_produk?: unknown;
  harga_satuan?: unknown;
  status?: unknown;
  foto_url?: unknown;
}) {
  const sku = typeof body.sku === "string" ? body.sku.trim().toUpperCase() : "";
  const nama_produk = typeof body.nama_produk === "string" ? body.nama_produk.trim() : "";
  const harga_satuan = Number(body.harga_satuan);
  const status = body.status === "non-aktif" ? "non-aktif" : "aktif";
  const foto_url =
    typeof body.foto_url === "string" && body.foto_url.startsWith("data:image/") ? body.foto_url : null;

  return { sku, nama_produk, harga_satuan, status, foto_url };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB();
  const { results } = await db
    .prepare(`SELECT * FROM sku_products ORDER BY status ASC, nama_produk ASC, sku ASC`)
    .all<SkuProductRow>();

  return NextResponse.json((results ?? []).map(serialize));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = parsePayload(await req.json());
  if (!payload.sku || !payload.nama_produk || !Number.isFinite(payload.harga_satuan) || payload.harga_satuan < 0) {
    return NextResponse.json({ error: "SKU, nama produk, dan harga valid wajib diisi" }, { status: 400 });
  }
  if (payload.foto_url && payload.foto_url.length > MAX_FOTO_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "Ukuran foto terlalu besar, coba foto lain" }, { status: 400 });
  }

  try {
    const db = getDB();
    const product = await db
      .prepare(
        `INSERT INTO sku_products (sku, nama_produk, harga_satuan, status, foto_url)
         VALUES (?1, ?2, ?3, ?4, ?5)
         RETURNING *`
      )
      .bind(payload.sku, payload.nama_produk, payload.harga_satuan, payload.status, payload.foto_url)
      .first<SkuProductRow>();

    return NextResponse.json(serialize(product!), { status: 201 });
  } catch (err) {
    console.error("POST /api/sku-produk failed", err);
    return NextResponse.json({ error: "Gagal menambah SKU produk. Pastikan SKU belum dipakai." }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const id = Number(body.id);
  const payload = parsePayload(body);
  if (!id || !payload.sku || !payload.nama_produk || !Number.isFinite(payload.harga_satuan) || payload.harga_satuan < 0) {
    return NextResponse.json({ error: "ID, SKU, nama produk, dan harga valid wajib diisi" }, { status: 400 });
  }
  if (payload.foto_url && payload.foto_url.length > MAX_FOTO_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "Ukuran foto terlalu besar, coba foto lain" }, { status: 400 });
  }

  try {
    const db = getDB();
    const product = await db
      .prepare(
        `UPDATE sku_products
         SET sku = ?1, nama_produk = ?2, harga_satuan = ?3, status = ?4, foto_url = ?5
         WHERE id = ?6
         RETURNING *`
      )
      .bind(payload.sku, payload.nama_produk, payload.harga_satuan, payload.status, payload.foto_url, id)
      .first<SkuProductRow>();

    if (!product) return NextResponse.json({ error: "SKU produk tidak ditemukan" }, { status: 404 });
    return NextResponse.json(serialize(product));
  } catch (err) {
    console.error("PATCH /api/sku-produk failed", err);
    return NextResponse.json({ error: "Gagal mengubah SKU produk. Pastikan SKU belum dipakai." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID SKU produk wajib diisi" }, { status: 400 });

  const db = getDB();
  try {
    await db.prepare(`DELETE FROM sku_products WHERE id = ?1`).bind(id).run();
  } catch {
    await db.prepare(`UPDATE sku_products SET status = 'non-aktif' WHERE id = ?1`).bind(id).run();
  }
  return NextResponse.json({ ok: true });
}
