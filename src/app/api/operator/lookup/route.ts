import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";


// GET /api/operator/lookup?barcode=OP-0001
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barcode = req.nextUrl.searchParams.get("barcode")?.trim();
  if (!barcode) return NextResponse.json({ error: "Barcode kosong" }, { status: 400 });

  const operator = await prisma.operator.findUnique({ where: { barcode_operator: barcode } });

  if (!operator) {
    return NextResponse.json({ error: "Operator tidak ditemukan. Cek kembali kartu ID." }, { status: 404 });
  }
  if (operator.status !== "aktif") {
    return NextResponse.json({ error: `Operator "${operator.nama_operator}" berstatus non-aktif.` }, { status: 409 });
  }

  return NextResponse.json(operator);
}
