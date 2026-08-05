import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { decimalToNumber } from "@/lib/utils";


export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const artikels = await prisma.artikel.findMany({ where: { status: "aktif" }, orderBy: { nama_artikel: "asc" } });
  return NextResponse.json(artikels.map((item) => ({ ...item, harga_satuan: decimalToNumber(item.harga_satuan) })));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { kode_artikel, nama_artikel, harga_satuan } = await req.json();
  const hargaNum = Number(harga_satuan);
  if (!nama_artikel || !Number.isFinite(hargaNum) || hargaNum <= 0) {
    return NextResponse.json({ error: "Nama artikel dan harga valid wajib diisi" }, { status: 400 });
  }

  const artikel = await prisma.artikel.create({
    data: {
      kode_artikel: kode_artikel || null,
      nama_artikel,
      harga_satuan: hargaNum,
      status: "aktif",
    },
  });

  return NextResponse.json({ ...artikel, harga_satuan: decimalToNumber(artikel.harga_satuan) }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID artikel wajib diisi" }, { status: 400 });

  try {
    await prisma.artikel.delete({ where: { id } });
  } catch {
    await prisma.artikel.update({ where: { id }, data: { status: "non-aktif" } });
  }
  return NextResponse.json({ ok: true });
}
