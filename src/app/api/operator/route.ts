import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";


export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const operators = await prisma.operator.findMany({ orderBy: { nama_operator: "asc" } });
  return NextResponse.json(operators);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { barcode_operator, nama_operator } = await req.json();
  if (!barcode_operator || !nama_operator) {
    return NextResponse.json({ error: "Barcode dan nama operator wajib diisi" }, { status: 400 });
  }

  const operator = await prisma.operator.create({
    data: { barcode_operator, nama_operator, status: "aktif" },
  });

  return NextResponse.json(operator, { status: 201 });
}
