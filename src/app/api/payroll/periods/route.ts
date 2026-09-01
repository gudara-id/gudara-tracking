import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { decimalToNumber } from "@/lib/utils";
import { recordActivity } from "@/lib/activity";

type PeriodRow = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  status: string;
  created_by: number;
  paid_by: number | null;
  paid_at: string | null;
  createdAt: string;
};

type TotalsRow = {
  period_id: number;
  base_upah: number | null;
  adjustments_total: number | null;
};

function canAccessPayroll(role: string) {
  return role === "admin_operasional";
}

// Operator jahit boleh MELIHAT (read-only) rekap gaji resmi mereka sendiri,
// tapi tidak boleh membuat/mengubah periode atau melihat data operator lain.
function canViewPayroll(role: string) {
  return canAccessPayroll(role) || role === "operator_jahit";
}

// GET /api/payroll/periods — list semua periode payroll, terbaru dulu, plus
// total gaji terhitung (upah borongan dari setoran_jahit + adjustment) untuk
// ditampilkan di daftar tanpa perlu membuka detail satu-satu.
//
// Operator jahit dapat versi terbatas: hanya periode yang SUDAH DIBAYAR
// (status 'paid'), dan totalnya sudah discope ke setoran/adjustment atas
// nama mereka sendiri saja (dicocokkan lewat nama_lengkap <-> nama_operator,
// pola yang sama dipakai di GET /api/setoran).
export async function GET() {
  const session = await getSession();
  if (!session || !canViewPayroll(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDB();

    if (session.role === "operator_jahit") {
      const namaOperator = session.nama_lengkap.trim().toLowerCase();

      const { results: periods } = await db
        .prepare(`SELECT * FROM payroll_periods WHERE status = 'paid' ORDER BY start_date DESC, id DESC`)
        .all<PeriodRow>();
      if (!periods?.length) return NextResponse.json([]);

      const { results: baseTotals } = await db
        .prepare(
          `SELECT p.id AS period_id, SUM(s.total_upah) AS base_upah
           FROM payroll_periods p
           LEFT JOIN setoran_jahit s ON s.tanggal_setoran >= p.start_date AND s.tanggal_setoran <= p.end_date
           LEFT JOIN operators o ON o.id = s.operator_id
           WHERE p.status = 'paid' AND LOWER(TRIM(o.nama_operator)) = ?1
           GROUP BY p.id`
        )
        .bind(namaOperator)
        .all<TotalsRow>();

      const { results: adjTotals } = await db
        .prepare(
          `SELECT a.period_id,
                  SUM(CASE WHEN a.type = 'bonus' THEN a.amount ELSE -a.amount END) AS adjustments_total
           FROM payroll_adjustments a
           JOIN operators o ON o.id = a.operator_id
           JOIN payroll_periods p ON p.id = a.period_id
           WHERE p.status = 'paid' AND LOWER(TRIM(o.nama_operator)) = ?1
           GROUP BY a.period_id`
        )
        .bind(namaOperator)
        .all<TotalsRow>();

      const baseMap = new Map((baseTotals ?? []).map((row) => [row.period_id, decimalToNumber(row.base_upah ?? 0)]));
      const adjMap = new Map((adjTotals ?? []).map((row) => [row.period_id, decimalToNumber(row.adjustments_total ?? 0)]));

      const serialized = periods
        .map((period) => {
          const baseUpah = baseMap.get(period.id) ?? 0;
          const adjustmentsTotal = adjMap.get(period.id) ?? 0;
          return {
            id: period.id,
            label: period.label,
            start_date: period.start_date,
            end_date: period.end_date,
            status: period.status,
            paid_at: period.paid_at,
            createdAt: period.createdAt,
            base_upah: baseUpah,
            adjustments_total: adjustmentsTotal,
            total_gaji: baseUpah + adjustmentsTotal,
          };
        })
        // Sembunyikan periode yang tidak ada aktivitas gaji sama sekali atas nama operator ini.
        .filter((period) => period.base_upah !== 0 || period.adjustments_total !== 0);

      return NextResponse.json(serialized);
    }

    const { results: periods } = await db
      .prepare(`SELECT * FROM payroll_periods ORDER BY start_date DESC, id DESC`)
      .all<PeriodRow>();

    if (!periods?.length) return NextResponse.json([]);

    // Upah borongan per periode: jumlah total_upah semua setoran yang jatuh
    // di rentang tanggal periode tsb.
    const { results: baseTotals } = await db
      .prepare(
        `SELECT p.id AS period_id, SUM(s.total_upah) AS base_upah
         FROM payroll_periods p
         LEFT JOIN setoran_jahit s ON s.tanggal_setoran >= p.start_date AND s.tanggal_setoran <= p.end_date
         GROUP BY p.id`
      )
      .all<TotalsRow>();

    const { results: adjTotals } = await db
      .prepare(
        `SELECT period_id,
                SUM(CASE WHEN type = 'bonus' THEN amount ELSE -amount END) AS adjustments_total
         FROM payroll_adjustments
         GROUP BY period_id`
      )
      .all<TotalsRow>();

    const baseMap = new Map((baseTotals ?? []).map((row) => [row.period_id, decimalToNumber(row.base_upah ?? 0)]));
    const adjMap = new Map((adjTotals ?? []).map((row) => [row.period_id, decimalToNumber(row.adjustments_total ?? 0)]));

    const serialized = periods.map((period) => {
      const baseUpah = baseMap.get(period.id) ?? 0;
      const adjustmentsTotal = adjMap.get(period.id) ?? 0;
      return {
        id: period.id,
        label: period.label,
        start_date: period.start_date,
        end_date: period.end_date,
        status: period.status,
        paid_at: period.paid_at,
        createdAt: period.createdAt,
        base_upah: baseUpah,
        adjustments_total: adjustmentsTotal,
        total_gaji: baseUpah + adjustmentsTotal,
      };
    });

    return NextResponse.json(serialized);
  } catch (err: unknown) {
    console.error("GET /api/payroll/periods failed", err);
    return NextResponse.json(
      { error: "Gagal memuat periode payroll. Pastikan migrasi database (payroll_periods) sudah dijalankan." },
      { status: 500 }
    );
  }
}

// POST /api/payroll/periods — buat periode payroll baru
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !canAccessPayroll(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { label, start_date, end_date } = await req.json();
  const trimmedLabel = String(label ?? "").trim();
  if (!trimmedLabel) return NextResponse.json({ error: "Nama periode wajib diisi" }, { status: 400 });
  if (!start_date || !end_date) {
    return NextResponse.json({ error: "Tanggal mulai dan tanggal akhir wajib diisi" }, { status: 400 });
  }

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return NextResponse.json({ error: "Rentang tanggal tidak valid" }, { status: 400 });
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  try {
    const db = getDB();
    const period = await db
      .prepare(
        `INSERT INTO payroll_periods (label, start_date, end_date, status, created_by) VALUES (?1, ?2, ?3, 'draft', ?4) RETURNING *`
      )
      .bind(trimmedLabel, start.toISOString(), end.toISOString(), session.userId)
      .first<PeriodRow>();

    await recordActivity({
      session,
      entity: "payroll",
      entityId: period?.id ?? null,
      action: "payroll_period_created",
      summary: `${session.nama_lengkap} membuat periode payroll "${trimmedLabel}"`,
      metadata: { start_date: start.toISOString(), end_date: end.toISOString() },
    }).catch((err) => console.error("recordActivity failed for payroll_period_created", err));

    return NextResponse.json(period, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/payroll/periods failed", err);
    return NextResponse.json(
      { error: "Gagal membuat periode payroll. Pastikan migrasi database (payroll_periods) sudah dijalankan." },
      { status: 500 }
    );
  }
}
