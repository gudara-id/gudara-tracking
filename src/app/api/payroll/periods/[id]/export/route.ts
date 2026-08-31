import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { decimalToNumber } from "@/lib/utils";
import * as XLSX from "xlsx";
import { format } from "date-fns";

function canAccessPayroll(role: string) {
  return role === "admin_produksi" || role === "admin_jahit";
}

type PeriodRow = { id: number; label: string; start_date: string; end_date: string; status: string };
type SetoranAggRow = { operator_id: number; nama_operator: string; total_qty: number; base_upah: number };
type AdjustmentRow = { operator_id: number; type: string; label: string; amount: number };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !canAccessPayroll(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodId = Number((await params).id);
  if (!periodId) return NextResponse.json({ error: "ID periode tidak valid" }, { status: 400 });

  const db = getDB();
  const period = await db.prepare(`SELECT * FROM payroll_periods WHERE id = ?1`).bind(periodId).first<PeriodRow>();
  if (!period) return NextResponse.json({ error: "Periode payroll tidak ditemukan" }, { status: 404 });

  const { results: setoranAgg } = await db
    .prepare(
      `SELECT o.id AS operator_id, o.nama_operator AS nama_operator,
              SUM(s.qty_disetor) AS total_qty, SUM(s.total_upah) AS base_upah
       FROM setoran_jahit s
       JOIN operators o ON o.id = s.operator_id
       WHERE s.tanggal_setoran >= ?1 AND s.tanggal_setoran <= ?2
       GROUP BY o.id, o.nama_operator`
    )
    .bind(period.start_date, period.end_date)
    .all<SetoranAggRow>();

  const { results: adjustments } = await db
    .prepare(
      `SELECT a.operator_id, a.type, a.label, a.amount, o.nama_operator
       FROM payroll_adjustments a JOIN operators o ON o.id = a.operator_id
       WHERE a.period_id = ?1`
    )
    .bind(periodId)
    .all<AdjustmentRow & { nama_operator: string }>();

  const operatorMap = new Map<
    number,
    { nama_operator: string; total_qty: number; base_upah: number; bonus: number; potongan: number }
  >();
  (setoranAgg ?? []).forEach((row) => {
    operatorMap.set(row.operator_id, {
      nama_operator: row.nama_operator,
      total_qty: Number(row.total_qty ?? 0),
      base_upah: decimalToNumber(row.base_upah ?? 0),
      bonus: 0,
      potongan: 0,
    });
  });
  (adjustments ?? []).forEach((adj) => {
    const existing = operatorMap.get(adj.operator_id) ?? {
      nama_operator: adj.nama_operator,
      total_qty: 0,
      base_upah: 0,
      bonus: 0,
      potongan: 0,
    };
    const amount = decimalToNumber(adj.amount);
    if (adj.type === "bonus") existing.bonus += amount;
    else existing.potongan += amount;
    operatorMap.set(adj.operator_id, existing);
  });

  const rekapRows = Array.from(operatorMap.values())
    .sort((a, b) => a.nama_operator.localeCompare(b.nama_operator))
    .map((op) => ({
      "Nama Operator": op.nama_operator,
      "Total QTY": op.total_qty,
      "Upah Borongan": op.base_upah,
      "Bonus": op.bonus,
      "Potongan": op.potongan,
      "Total Diterima": op.base_upah + op.bonus - op.potongan,
    }));

  const grandTotalRow = {
    "Nama Operator": "TOTAL",
    "Total QTY": rekapRows.reduce((sum, r) => sum + r["Total QTY"], 0),
    "Upah Borongan": rekapRows.reduce((sum, r) => sum + r["Upah Borongan"], 0),
    "Bonus": rekapRows.reduce((sum, r) => sum + r["Bonus"], 0),
    "Potongan": rekapRows.reduce((sum, r) => sum + r["Potongan"], 0),
    "Total Diterima": rekapRows.reduce((sum, r) => sum + r["Total Diterima"], 0),
  };

  const detailRows = (adjustments ?? []).map((adj) => ({
    "Nama Operator": adj.nama_operator,
    "Jenis": adj.type === "bonus" ? "Bonus" : "Potongan",
    "Keterangan": adj.label,
    "Nominal": decimalToNumber(adj.amount),
  }));

  const workbook = XLSX.utils.book_new();
  const rekapSheet = XLSX.utils.json_to_sheet([...rekapRows, grandTotalRow]);
  rekapSheet["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, rekapSheet, "Rekap Gaji");

  const detailSheet = XLSX.utils.json_to_sheet(
    detailRows.length ? detailRows : [{ "Nama Operator": "-", Jenis: "-", Keterangan: "Tidak ada adjustment", Nominal: 0 }]
  );
  detailSheet["!cols"] = [{ wch: 24 }, { wch: 10 }, { wch: 30 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, detailSheet, "Detail Bonus & Potongan");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const fileName = `Payroll_${period.label.replace(/[^a-zA-Z0-9]+/g, "_")}_${format(new Date(), "yyyyMMdd")}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
