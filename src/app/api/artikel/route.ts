import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { decimalToNumber } from "@/lib/utils";

type ArtikelRow = {
  id: number;
  kode_artikel: string | null;
  nama_artikel: string;
  harga_satuan: number;
  harga_jual: number | null;
  status: string;
  createdAt: string;
};

function serialize(item: ArtikelRow) {
  return {
    ...item,
    harga_satuan: decimalToNumber(item.harga_satuan),
    harga_jual: item.harga_jual == null ? 0 : decimalToNumber(item.harga_jual),
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  if (includeInactive && session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDB();
  const { results } = await db
    .prepare(`SELECT * FROM artikels ${includeInactive ? "" : "WHERE status = 'aktif'"} ORDER BY nama_artikel ASC`)
    .all<ArtikelRow>();

  return NextResponse.json((results ?? []).map(serialize));
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [Number(body.id)];
  const validIds = ids.filter((id: number) => Number.isInteger(id) && id > 0);
  if (validIds.length === 0) {
    return NextResponse.json({ error: "Pilih minimal satu artikel" }, { status: 400 });
  }

  const updates: string[] = [];
  const values: Array<string | number | null> = [];
  const isBulk = validIds.length > 1;

  if (body.kode_artikel !== undefined && !isBulk) {
    updates.push("kode_artikel = ?");
    values.push(body.kode_artikel?.trim() || null);
  }
  if (body.nama_artikel !== undefined && !isBulk) {
    const namaArtikel = String(body.nama_artikel).trim();
    if (!namaArtikel) return NextResponse.json({ error: "Nama artikel wajib diisi" }, { status: 400 });
    updates.push("nama_artikel = ?");
    values.push(namaArtikel);
  }
  if (body.harga_satuan !== undefined && body.harga_satuan !== "") {
    const hargaSatuan = Number(body.harga_satuan);
    if (!Number.isFinite(hargaSatuan) || hargaSatuan <= 0) {
      return NextResponse.json({ error: "Ongkos jahit harus lebih dari 0" }, { status: 400 });
    }
    updates.push("harga_satuan = ?");
    values.push(hargaSatuan);
  }
  if (body.harga_jual !== undefined && body.harga_jual !== "") {
    const hargaJual = Number(body.harga_jual);
    if (!Number.isFinite(hargaJual) || hargaJual < 0) {
      return NextResponse.json({ error: "Harga jual tidak valid" }, { status: 400 });
    }
    updates.push("harga_jual = ?");
    values.push(hargaJual);
  }
  if (body.status !== undefined) {
    if (!['aktif', 'non-aktif'].includes(body.status)) {
      return NextResponse.json({ error: "Status artikel tidak valid" }, { status: 400 });
    }
    updates.push("status = ?");
    values.push(body.status);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "Pilih data yang ingin diubah" }, { status: 400 });
  }

  const placeholders = validIds.map(() => "?").join(", ");
  const db = getDB();
  await db.prepare(`UPDATE artikels SET ${updates.join(", ")} WHERE id IN (${placeholders})`).bind(...values, ...validIds).run();

  const { results } = await db
    .prepare(`SELECT * FROM artikels WHERE id IN (${placeholders}) ORDER BY nama_artikel ASC`)
    .bind(...validIds)
    .all<ArtikelRow>();
  return NextResponse.json((results ?? []).map(serialize));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { kode_artikel, nama_artikel, harga_satuan, harga_jual } = await req.json();
  const hargaNum = Number(harga_satuan);
  // Harga jual bersifat opsional - kalau kosong disimpan 0 (artinya artikel
  // ini belum dijual ke customer, tetap bisa dipakai untuk hitung gaji jahit).
  const hargaJualNum = harga_jual === undefined || harga_jual === null || harga_jual === "" ? 0 : Number(harga_jual);
  if (!nama_artikel || !Number.isFinite(hargaNum) || hargaNum <= 0) {
    return NextResponse.json({ error: "Nama artikel dan harga valid wajib diisi" }, { status: 400 });
  }
  if (!Number.isFinite(hargaJualNum) || hargaJualNum < 0) {
    return NextResponse.json({ error: "Harga jual tidak valid" }, { status: 400 });
  }

  const db = getDB();
  const artikel = await db
    .prepare(
      `INSERT INTO artikels (kode_artikel, nama_artikel, harga_satuan, harga_jual, status) VALUES (?1, ?2, ?3, ?4, 'aktif') RETURNING *`
    )
    .bind(kode_artikel || null, nama_artikel, hargaNum, hargaJualNum)
    .first<ArtikelRow>();

  return NextResponse.json(serialize(artikel!), { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID artikel wajib diisi" }, { status: 400 });

  const db = getDB();
  try {
    await db.prepare(`DELETE FROM artikels WHERE id = ?1`).bind(id).run();
  } catch {
    await db.prepare(`UPDATE artikels SET status = 'non-aktif' WHERE id = ?1`).bind(id).run();
  }
  return NextResponse.json({ ok: true });
}
