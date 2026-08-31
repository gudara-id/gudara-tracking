import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { decimalToNumber } from "@/lib/utils";

type SetoranExportRow = {
  id: number;
  tanggal_setoran: string; // ISO 8601 string, as Prisma writes SQLite DateTime columns
  qty_disetor: number;
  qty_reject: number;
  catatan_reject: string | null;
  harga_satuan_snapshot: number;
  total_upah: number;
  operator_nama_operator: string;
  po_nama_po: string;
  po_nama_artikel: string;
};

const SETORAN_EXPORT_SELECT = `
  SELECT
    s.id, s.tanggal_setoran, s.qty_disetor, s.qty_reject, s.catatan_reject, s.harga_satuan_snapshot, s.total_upah,
    o.nama_operator AS operator_nama_operator,
    po.nama_po AS po_nama_po,
    po.nama_artikel AS po_nama_artikel
  FROM setoran_jahit s
  JOIN operators o ON o.id = s.operator_id
  JOIN purchase_orders po ON po.id = s.po_id
`;

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

  const db = getDB();
  const values: unknown[] = [startOfDay.toISOString(), endOfDay.toISOString()];
  let where = `s.tanggal_setoran >= ?1 AND s.tanggal_setoran <= ?2`;
  if (operatorIdParam) {
    values.push(Number(operatorIdParam));
    where += ` AND s.operator_id = ?${values.length}`;
  }

  const { results } = await db
    .prepare(`${SETORAN_EXPORT_SELECT} WHERE ${where} ORDER BY s.tanggal_setoran ASC`)
    .bind(...values)
    .all<SetoranExportRow>();

  let entries = results ?? [];

  // Operator jahit hanya boleh mengekspor setoran atas namanya sendiri.
  if (session.role === "operator_jahit") {
    const namaUser = session.nama_lengkap.trim().toLowerCase();
    entries = entries.filter((entry) => entry.operator_nama_operator.trim().toLowerCase() === namaUser);
  }

  const rows = entries.map((e) => ({
    "Nama Operator Jahit": e.operator_nama_operator,
    "Nama PO": e.po_nama_po,
    "Tanggal Setoran": format(new Date(e.tanggal_setoran), "dd/MM/yyyy HH:mm"),
    "Artikel": e.po_nama_artikel,
    "Harga Satuan": decimalToNumber(e.harga_satuan_snapshot),
    "QTY Bagus": e.qty_disetor,
    "QTY Reject": e.qty_reject ?? 0,
    "Catatan Reject": e.catatan_reject ?? "",
    "Totalan (Total Upah)": decimalToNumber(e.total_upah),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 28 }, { wch: 16 },
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
