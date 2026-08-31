import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";

type OperatorRow = {
  id: number;
  barcode_operator: string;
  nama_operator: string;
  status: string;
  createdAt: string;
};

// GET /api/operator/lookup?barcode=OP-0001
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barcode = req.nextUrl.searchParams.get("barcode")?.trim();
  if (!barcode) return NextResponse.json({ error: "Barcode kosong" }, { status: 400 });

  const db = getDB();
  const operator = await db
    .prepare(`SELECT * FROM operators WHERE barcode_operator = ?1`)
    .bind(barcode)
    .first<OperatorRow>();

  if (!operator) {
    return NextResponse.json({ error: "Operator tidak ditemukan. Cek kembali kartu ID." }, { status: 404 });
  }
  if (operator.status !== "aktif") {
    return NextResponse.json({ error: `Operator "${operator.nama_operator}" berstatus non-aktif.` }, { status: 409 });
  }

  return NextResponse.json(operator);
}
