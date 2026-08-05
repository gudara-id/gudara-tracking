import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { decimalToNumber } from "@/lib/utils";


// GET /api/po/lookup?barcode=GDR-PO-...
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barcode = req.nextUrl.searchParams.get("barcode")?.trim();
  if (!barcode) return NextResponse.json({ error: "Barcode kosong" }, { status: 400 });

  const po = await prisma.purchaseOrder.findUnique({ where: { barcode_po: barcode } });

  if (!po) {
    return NextResponse.json({ error: "PO tidak ditemukan. Cek kembali barcode." }, { status: 404 });
  }
  if (po.status === "selesai" || po.status === "TERKIRIM") {
    return NextResponse.json({ error: `PO "${po.nama_po}" sudah berstatus selesai.` }, { status: 409 });
  }

  return NextResponse.json({ ...po, harga_satuan: decimalToNumber(po.harga_satuan) });
}
