import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { decimalToNumber } from "@/lib/utils";

type PoRow = {
  id: number;
  nomor_po: string;
  barcode_po: string;
  nama_po: string;
  nama_artikel: string;
  harga_satuan: number;
  target_qty: number | null;
  status: string;
  label: string | null;
  due_date: string | null;
  description: string | null;
  created_by: number;
  createdAt: string;
};

// GET /api/po/lookup?barcode=GDR-PO-...
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barcode = req.nextUrl.searchParams.get("barcode")?.trim();
  if (!barcode) return NextResponse.json({ error: "Barcode kosong" }, { status: 400 });

  const db = getDB();
  const po = await db
    .prepare(`SELECT * FROM purchase_orders WHERE barcode_po = ?1`)
    .bind(barcode)
    .first<PoRow>();

  if (!po) {
    return NextResponse.json({ error: "PO tidak ditemukan. Cek kembali barcode." }, { status: 404 });
  }
  if (po.status === "selesai" || po.status === "TERKIRIM") {
    return NextResponse.json({ error: `PO "${po.nama_po}" sudah berstatus selesai.` }, { status: 409 });
  }

  const setoranRow = await db
    .prepare(`SELECT COALESCE(SUM(qty_disetor), 0) AS total FROM setoran_jahit WHERE po_id = ?1`)
    .bind(po.id)
    .first<{ total: number }>();
  const qty_terselesaikan = setoranRow?.total ?? 0;

  return NextResponse.json({
    ...po,
    harga_satuan: decimalToNumber(po.harga_satuan),
    qty_terselesaikan,
  });
}
