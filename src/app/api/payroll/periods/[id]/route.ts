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
  created_by_nama?: string;
  paid_by_nama?: string | null;
};

type SetoranAggRow = {
  operator_id: number;
  nama_operator: string;
  total_qty: number;
  base_upah: number;
};

type AdjustmentRow = {
  id: number;
  period_id: number;
  operator_id: number;
  type: string;
  label: string;
  amount: number;
  created_by: number;
  createdAt: string;
  created_by_nama: string;
};

function canAccessPayroll(role: string) {
  return role === "admin_operasional";
}

function canViewPayroll(role: string) {
  return canAccessPayroll(role) || role === "operator_jahit";
}

async function loadPeriodDetail(db: ReturnType<typeof getDB>, periodId: number) {
  const period = await db
    .prepare(
      `SELECT p.*, cu.nama_lengkap AS created_by_nama, pu.nama_lengkap AS paid_by_nama
       FROM payroll_periods p
       LEFT JOIN users cu ON cu.id = p.created_by
       LEFT JOIN users pu ON pu.id = p.paid_by
       WHERE p.id = ?1`
    )
    .bind(periodId)
    .first<PeriodRow>();
  if (!period) return null;

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
      `SELECT a.*, u.nama_lengkap AS created_by_nama
       FROM payroll_adjustments a
       JOIN users u ON u.id = a.created_by
       WHERE a.period_id = ?1
       ORDER BY a.createdAt ASC`
    )
    .bind(periodId)
    .all<AdjustmentRow>();

  // Operator bisa punya adjustment tanpa setoran di periode ini (mis. bonus
  // kehadiran tanpa target borongan) — pastikan tetap muncul di rekap.
  const operatorIdsWithoutSetoran = Array.from(
    new Set((adjustments ?? []).map((adj) => adj.operator_id))
  ).filter((id) => !(setoranAgg ?? []).some((row) => row.operator_id === id));

  let extraOperators: { id: number; nama_operator: string }[] = [];
  if (operatorIdsWithoutSetoran.length) {
    const placeholders = operatorIdsWithoutSetoran.map((_, i) => `?${i + 1}`).join(",");
    const { results } = await db
      .prepare(`SELECT id, nama_operator FROM operators WHERE id IN (${placeholders})`)
      .bind(...operatorIdsWithoutSetoran)
      .all<{ id: number; nama_operator: string }>();
    extraOperators = results ?? [];
  }

  const operatorMap = new Map<
    number,
    { operator_id: number; nama_operator: string; total_qty: number; base_upah: number }
  >();
  (setoranAgg ?? []).forEach((row) => {
    operatorMap.set(row.operator_id, {
      operator_id: row.operator_id,
      nama_operator: row.nama_operator,
      total_qty: Number(row.total_qty ?? 0),
      base_upah: decimalToNumber(row.base_upah ?? 0),
    });
  });
  extraOperators.forEach((op) => {
    operatorMap.set(op.id, { operator_id: op.id, nama_operator: op.nama_operator, total_qty: 0, base_upah: 0 });
  });

  const adjustmentsByOperator = new Map<number, AdjustmentRow[]>();
  (adjustments ?? []).forEach((adj) => {
    const list = adjustmentsByOperator.get(adj.operator_id) ?? [];
    list.push(adj);
    adjustmentsByOperator.set(adj.operator_id, list);
  });

  const operators = Array.from(operatorMap.values())
    .map((op) => {
      const opAdjustments = (adjustmentsByOperator.get(op.operator_id) ?? []).map((adj) => ({
        id: adj.id,
        type: adj.type,
        label: adj.label,
        amount: decimalToNumber(adj.amount),
        created_by_nama: adj.created_by_nama,
        createdAt: adj.createdAt,
      }));
      const bonusTotal = opAdjustments.filter((a) => a.type === "bonus").reduce((sum, a) => sum + a.amount, 0);
      const potonganTotal = opAdjustments.filter((a) => a.type === "potongan").reduce((sum, a) => sum + a.amount, 0);
      return {
        operator_id: op.operator_id,
        nama_operator: op.nama_operator,
        total_qty: op.total_qty,
        base_upah: op.base_upah,
        adjustments: opAdjustments,
        bonus_total: bonusTotal,
        potongan_total: potonganTotal,
        total_gaji: op.base_upah + bonusTotal - potonganTotal,
      };
    })
    .sort((a, b) => a.nama_operator.localeCompare(b.nama_operator));

  const grandTotal = {
    total_qty: operators.reduce((sum, op) => sum + op.total_qty, 0),
    base_upah: operators.reduce((sum, op) => sum + op.base_upah, 0),
    bonus_total: operators.reduce((sum, op) => sum + op.bonus_total, 0),
    potongan_total: operators.reduce((sum, op) => sum + op.potongan_total, 0),
    total_gaji: operators.reduce((sum, op) => sum + op.total_gaji, 0),
  };

  return {
    id: period.id,
    label: period.label,
    start_date: period.start_date,
    end_date: period.end_date,
    status: period.status,
    created_by_nama: period.created_by_nama ?? null,
    paid_by_nama: period.paid_by_nama ?? null,
    paid_at: period.paid_at,
    createdAt: period.createdAt,
    operators,
    grandTotal,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !canViewPayroll(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodId = Number((await params).id);
  if (!periodId) return NextResponse.json({ error: "ID periode tidak valid" }, { status: 400 });

  try {
    const db = getDB();
    const detail = await loadPeriodDetail(db, periodId);
    if (!detail) return NextResponse.json({ error: "Periode payroll tidak ditemukan" }, { status: 404 });

    if (session.role === "operator_jahit") {
      // Operator hanya boleh melihat slip mereka sendiri, di periode yang
      // sudah final (dibayar) — bukan draft yang masih bisa berubah.
      if (detail.status !== "paid") {
        return NextResponse.json({ error: "Periode payroll tidak ditemukan" }, { status: 404 });
      }
      const namaOperator = session.nama_lengkap.trim().toLowerCase();
      const own = detail.operators.filter((op) => op.nama_operator.trim().toLowerCase() === namaOperator);
      if (!own.length) {
        return NextResponse.json({ error: "Tidak ada data gaji atas nama Anda pada periode ini" }, { status: 404 });
      }
      const grandTotal = {
        total_qty: own.reduce((sum, op) => sum + op.total_qty, 0),
        base_upah: own.reduce((sum, op) => sum + op.base_upah, 0),
        bonus_total: own.reduce((sum, op) => sum + op.bonus_total, 0),
        potongan_total: own.reduce((sum, op) => sum + op.potongan_total, 0),
        total_gaji: own.reduce((sum, op) => sum + op.total_gaji, 0),
      };
      return NextResponse.json({ ...detail, operators: own, grandTotal });
    }

    return NextResponse.json(detail);
  } catch (err: unknown) {
    console.error("GET /api/payroll/periods/[id] failed", err);
    return NextResponse.json({ error: "Gagal memuat detail periode payroll." }, { status: 500 });
  }
}

// PATCH — ubah status (draft <-> paid) atau edit label/tanggal (hanya saat draft)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !canAccessPayroll(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodId = Number((await params).id);
  if (!periodId) return NextResponse.json({ error: "ID periode tidak valid" }, { status: 400 });

  const body = await req.json();
  const db = getDB();

  try {
    const existing = await db.prepare(`SELECT * FROM payroll_periods WHERE id = ?1`).bind(periodId).first<PeriodRow>();
    if (!existing) return NextResponse.json({ error: "Periode payroll tidak ditemukan" }, { status: 404 });

    if (body.status && (body.status === "paid" || body.status === "draft")) {
      if (body.status === "paid") {
        await db
          .prepare(`UPDATE payroll_periods SET status = 'paid', paid_by = ?1, paid_at = CURRENT_TIMESTAMP WHERE id = ?2`)
          .bind(session.userId, periodId)
          .run();
      } else {
        await db
          .prepare(`UPDATE payroll_periods SET status = 'draft', paid_by = NULL, paid_at = NULL WHERE id = ?1`)
          .bind(periodId)
          .run();
      }
      await recordActivity({
        session,
        entity: "payroll",
        entityId: periodId,
        action: "payroll_period_status_changed",
        summary: `${session.nama_lengkap} menandai periode "${existing.label}" sebagai ${
          body.status === "paid" ? "Sudah Dibayar" : "Draft"
        }`,
      }).catch((err) => console.error("recordActivity failed for payroll_period_status_changed", err));
    }

    if (body.label !== undefined || body.start_date !== undefined || body.end_date !== undefined) {
      if (existing.status !== "draft") {
        return NextResponse.json({ error: "Periode yang sudah dibayar tidak bisa diedit tanggalnya" }, { status: 400 });
      }
      const label = body.label !== undefined ? String(body.label).trim() : existing.label;
      const startDate = body.start_date !== undefined ? new Date(body.start_date) : new Date(existing.start_date);
      const endDate = body.end_date !== undefined ? new Date(body.end_date) : new Date(existing.end_date);
      if (!label) return NextResponse.json({ error: "Nama periode wajib diisi" }, { status: 400 });
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
        return NextResponse.json({ error: "Rentang tanggal tidak valid" }, { status: 400 });
      }
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      await db
        .prepare(`UPDATE payroll_periods SET label = ?1, start_date = ?2, end_date = ?3 WHERE id = ?4`)
        .bind(label, startDate.toISOString(), endDate.toISOString(), periodId)
        .run();
    }

    const detail = await loadPeriodDetail(db, periodId);
    return NextResponse.json(detail);
  } catch (err: unknown) {
    console.error("PATCH /api/payroll/periods/[id] failed", err);
    return NextResponse.json({ error: "Gagal memperbarui periode payroll." }, { status: 500 });
  }
}

// DELETE — hanya boleh menghapus periode yang masih draft (safety, supaya
// periode yang sudah ditandai dibayar tidak bisa hilang begitu saja)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !canAccessPayroll(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodId = Number((await params).id);
  if (!periodId) return NextResponse.json({ error: "ID periode tidak valid" }, { status: 400 });

  const db = getDB();
  const existing = await db.prepare(`SELECT * FROM payroll_periods WHERE id = ?1`).bind(periodId).first<PeriodRow>();
  if (!existing) return NextResponse.json({ error: "Periode payroll tidak ditemukan" }, { status: 404 });
  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Periode yang sudah dibayar tidak bisa dihapus" }, { status: 400 });
  }

  await db.prepare(`DELETE FROM payroll_periods WHERE id = ?1`).bind(periodId).run();

  await recordActivity({
    session,
    entity: "payroll",
    entityId: periodId,
    action: "payroll_period_deleted",
    summary: `${session.nama_lengkap} menghapus periode payroll "${existing.label}"`,
  }).catch((err) => console.error("recordActivity failed for payroll_period_deleted", err));

  return NextResponse.json({ ok: true });
}
