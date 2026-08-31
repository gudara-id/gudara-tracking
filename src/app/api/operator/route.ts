import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { generateOperatorBarcode, isOperatorStatus } from "@/lib/validators";

type OperatorRow = {
  id: number;
  barcode_operator: string;
  nama_operator: string;
  status: string;
  createdAt: string;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB();
  const { results } = await db
    .prepare(`SELECT * FROM operators ORDER BY nama_operator ASC`)
    .all<OperatorRow>();
  return NextResponse.json(results ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nama_operator } = await req.json();
  if (!nama_operator || !String(nama_operator).trim()) {
    return NextResponse.json({ error: "Nama operator wajib diisi" }, { status: 400 });
  }

  const db = getDB();

  // Auto-generate a unique scannable barcode for this operator's ID card.
  // Retries a few times in case of a rare sequence collision (e.g. after deletions).
  let operator: OperatorRow | null = null;
  for (let attempt = 0; attempt < 5 && !operator; attempt++) {
    const countRow = await db.prepare(`SELECT COUNT(*) as count FROM operators`).first<{ count: number }>();
    const count = countRow?.count ?? 0;
    const barcode_operator = generateOperatorBarcode(count + 1 + attempt);
    try {
      operator = await db
        .prepare(
          `INSERT INTO operators (barcode_operator, nama_operator, status) VALUES (?1, ?2, 'aktif') RETURNING *`
        )
        .bind(barcode_operator, String(nama_operator).trim())
        .first<OperatorRow>();
    } catch (err: unknown) {
      if (!String(err).includes("UNIQUE constraint")) throw err;
    }
  }

  if (!operator) {
    return NextResponse.json({ error: "Gagal membuat barcode unik, coba lagi" }, { status: 500 });
  }

  return NextResponse.json(operator, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, nama_operator, status } = await req.json();
  if (!id) return NextResponse.json({ error: "ID operator wajib diisi" }, { status: 400 });
  if (status !== undefined && !isOperatorStatus(status)) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  const db = getDB();

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (nama_operator !== undefined) {
    sets.push(`nama_operator = ?${i++}`);
    values.push(String(nama_operator).trim());
  }
  if (status !== undefined) {
    sets.push(`status = ?${i++}`);
    values.push(status);
  }

  if (sets.length === 0) {
    const existing = await db.prepare(`SELECT * FROM operators WHERE id = ?1`).bind(Number(id)).first<OperatorRow>();
    if (!existing) return NextResponse.json({ error: "Operator tidak ditemukan" }, { status: 404 });
    return NextResponse.json(existing);
  }

  values.push(Number(id));
  const operator = await db
    .prepare(`UPDATE operators SET ${sets.join(", ")} WHERE id = ?${i} RETURNING *`)
    .bind(...values)
    .first<OperatorRow>();

  if (!operator) {
    return NextResponse.json({ error: "Operator tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json(operator);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID operator wajib diisi" }, { status: 400 });

  const db = getDB();
  try {
    await db.prepare(`DELETE FROM operators WHERE id = ?1`).bind(id).run();
  } catch {
    return NextResponse.json({ error: "Operator sudah memiliki histori setoran sehingga tidak bisa dihapus" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
