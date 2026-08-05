import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { decimalToNumber } from "@/lib/utils";


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
    orderBy: { tanggal_setoran: "asc" },
    include: {
      operator: { select: { nama_operator: true } },
      po: { select: { nama_po: true, nama_artikel: true } },
    },
  });

  // Operator jahit hanya boleh mengekspor setoran atas namanya sendiri.
  if (session.role === "operator_jahit") {
    const namaUser = session.nama_lengkap.trim().toLowerCase();
    entries = entries.filter((entry) => entry.operator.nama_operator.trim().toLowerCase() === namaUser);
  }

  const rows = entries.map((e) => ({
    "Nama Operator Jahit": e.operator.nama_operator,
    "Nama PO": e.po.nama_po,
    "Tanggal Setoran": format(e.tanggal_setoran, "dd/MM/yyyy HH:mm"),
    "Artikel": e.po.nama_artikel,
    "Harga Satuan": decimalToNumber(e.harga_satuan_snapshot),
    "QTY": e.qty_disetor,
    "Totalan (Total Upah)": decimalToNumber(e.total_upah),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 8 }, { wch: 16 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Setoran Jahit");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename =
    format(startOfDay, "yyyy-MM-dd") === format(endOfDay, "yyyy-MM-dd")
      ? `Setoran-Jahit-${format(startOfDay, "yyyy-MM-dd")}.xlsx`
      : `Setoran-Jahit-${format(startOfDay, "yyyy-MM-dd")}_sd_${format(endOfDay, "yyyy-MM-dd")}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}