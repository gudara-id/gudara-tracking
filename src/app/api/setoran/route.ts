import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { decimalToNumber } from "@/lib/utils";


// GET /api/setoran?date=2026-08-04                (single day, defaults to today)
// GET /api/setoran?start=2026-08-03&end=2026-08-08 (date range, inclusive)
// GET /api/setoran?...&operator_id=5                (optional: filter satu operator)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startParam = req.nextUrl.searchParams.get("start");
  const endParam = req.nextUrl.searchParams.get("end");
  const dateParam = req.nextUrl.searchParams.get("date");
  const operatorIdParam = req.nextUrl.searchParams.get("operator_id");

  const rangeStartSource = startParam ? new Date(startParam) : dateParam ? new Date(dateParam) : new Date();
  const rangeEndSource = endParam ? new Date(endParam) : rangeStartSource;

  const startOfDay = new Date(rangeStartSource);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(rangeEndSource);
  endOfDay.setHours(23, 59, 59, 999);

  let entries = await prisma.setoranJahit.findMany({
    where: {
      tanggal_setoran: { gte: startOfDay, lte: endOfDay },
      ...(operatorIdParam ? { operator_id: Number(operatorIdParam) } : {}),
    },
    orderBy: { tanggal_setoran: "desc" },
    include: {
      operator: { select: { nama_operator: true } },
      po: { select: { nama_po: true, nama_artikel: true } },
      adminJahit: { select: { nama_lengkap: true } },
    },
  });

  // Operator jahit hanya boleh melihat setoran atas namanya sendiri.
  // Nama user (nama_lengkap) harus sama persis dengan nama_operator di
  // database operator agar pencocokan ini berjalan.
  if (session.role === "operator_jahit") {
    const namaUser = session.nama_lengkap.trim().toLowerCase();
    entries = entries.filter((entry) => entry.operator.nama_operator.trim().toLowerCase() === namaUser);
  }

  return NextResponse.json(
    entries.map((entry) => ({
      ...entry,
      harga_satuan_snapshot: decimalToNumber(entry.harga_satuan_snapshot),
      total_upah: decimalToNumber(entry.total_upah),
    }))
  );
}

// POST - the scanner submits { operator_id, po_id, qty_disetor }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_jahit") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { operator_id, po_id, qty_disetor } = await req.json();

  const qty = Number(qty_disetor);

  if (!operator_id || !po_id || !Number.isInteger(qty) || qty <= 0) {
    return NextResponse.json({ error: "Data tidak lengkap atau QTY tidak valid" }, { status: 400 });
  }

  const [operator, po] = await Promise.all([
    prisma.operator.findUnique({ where: { id: Number(operator_id) } }),
    prisma.purchaseOrder.findUnique({ where: { id: Number(po_id) } }),
  ]);

  if (!operator) return NextResponse.json({ error: "Operator tidak ditemukan" }, { status: 404 });
  if (!po) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });
  if (operator.status !== "aktif") {
    return NextResponse.json({ error: `Operator "${operator.nama_operator}" berstatus non-aktif` }, { status: 409 });
  }
  if (po.status === "selesai" || po.status === "TERKIRIM") {
    return NextResponse.json({ error: `PO "${po.nama_po}" sudah berstatus selesai` }, { status: 409 });
  }

  const harga_satuan_snapshot = decimalToNumber(po.harga_satuan);
  const total_upah = qty * harga_satuan_snapshot;

  const setoran = await prisma.setoranJahit.create({
    data: {
      operator_id: operator.id,
      po_id: po.id,
      qty_disetor: qty,
      harga_satuan_snapshot,
      total_upah,
      admin_jahit_id: session.userId,
    },
    include: {
      operator: { select: { nama_operator: true } },
      po: { select: { nama_po: true, nama_artikel: true } },
    },
  });

  return NextResponse.json(
    {
      ...setoran,
      harga_satuan_snapshot: decimalToNumber(setoran.harga_satuan_snapshot),
      total_upah: decimalToNumber(setoran.total_upah),
    },
    { status: 201 }
  );
}