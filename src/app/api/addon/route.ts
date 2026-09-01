import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { decimalToNumber } from "@/lib/utils";

type AddOnRow = {
  id: number;
  nama: string;
  harga: number;
  status: string;
  createdAt: string;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB();
  try {
    const { results } = await db
      .prepare(`SELECT * FROM add_ons WHERE status = 'aktif' ORDER BY nama ASC`)
      .all<AddOnRow>();

    return NextResponse.json((results ?? []).map((item) => ({ ...item, harga: decimalToNumber(item.harga) })));
  } catch (err) {
    // add_ons not migrated yet on this environment — don't 500 the whole
    // Konfigurasi page / PO form because of it.
    console.error("GET /api/addon failed (table may not be migrated yet)", err);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_operasional") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nama, harga } = await req.json();
  const hargaNum = Number(harga);
  if (!nama || !Number.isFinite(hargaNum) || hargaNum <= 0) {
    return NextResponse.json({ error: "Nama add-on dan harga valid wajib diisi" }, { status: 400 });
  }

  const db = getDB();
  try {
    const addon = await db
      .prepare(`INSERT INTO add_ons (nama, harga, status) VALUES (?1, ?2, 'aktif') RETURNING *`)
      .bind(nama, hargaNum)
      .first<AddOnRow>();

    return NextResponse.json({ ...addon, harga: decimalToNumber(addon!.harga) }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/addon failed", err);
    const message = String(err).includes("UNIQUE") ? "Nama add-on sudah ada" : "Gagal menyimpan add-on ke database";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_operasional") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID add-on wajib diisi" }, { status: 400 });

  const db = getDB();
  try {
    await db.prepare(`DELETE FROM add_ons WHERE id = ?1`).bind(id).run();
  } catch {
    await db.prepare(`UPDATE add_ons SET status = 'non-aktif' WHERE id = ?1`).bind(id).run();
  }
  return NextResponse.json({ ok: true });
}
