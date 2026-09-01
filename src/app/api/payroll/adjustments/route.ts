import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";

function canAccessPayroll(role: string) {
  return role === "admin_operasional";
}

// POST /api/payroll/adjustments — tambah bonus/potongan/kasbon untuk satu
// operator di dalam satu periode payroll.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !canAccessPayroll(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { period_id, operator_id, type, label, amount } = await req.json();
  const periodId = Number(period_id);
  const operatorId = Number(operator_id);
  const amountNum = Number(amount);
  const trimmedLabel = String(label ?? "").trim();

  if (!periodId || !operatorId) {
    return NextResponse.json({ error: "Periode dan operator wajib diisi" }, { status: 400 });
  }
  if (type !== "bonus" && type !== "potongan") {
    return NextResponse.json({ error: "Jenis adjustment tidak valid" }, { status: 400 });
  }
  if (!trimmedLabel) return NextResponse.json({ error: "Keterangan wajib diisi" }, { status: 400 });
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "Nominal harus lebih dari 0" }, { status: 400 });
  }

  const db = getDB();
  const period = await db.prepare(`SELECT id, label, status FROM payroll_periods WHERE id = ?1`).bind(periodId).first<{
    id: number;
    label: string;
    status: string;
  }>();
  if (!period) return NextResponse.json({ error: "Periode payroll tidak ditemukan" }, { status: 404 });

  const operator = await db.prepare(`SELECT id, nama_operator FROM operators WHERE id = ?1`).bind(operatorId).first<{
    id: number;
    nama_operator: string;
  }>();
  if (!operator) return NextResponse.json({ error: "Operator tidak ditemukan" }, { status: 404 });

  const adjustment = await db
    .prepare(
      `INSERT INTO payroll_adjustments (period_id, operator_id, type, label, amount, created_by)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING *`
    )
    .bind(periodId, operatorId, type, trimmedLabel, amountNum, session.userId)
    .first();

  await recordActivity({
    session,
    entity: "payroll",
    entityId: periodId,
    action: "payroll_adjustment_added",
    summary: `${session.nama_lengkap} menambah ${type === "bonus" ? "bonus" : "potongan"} "${trimmedLabel}" (Rp ${amountNum.toLocaleString(
      "id-ID"
    )}) untuk ${operator.nama_operator} pada periode "${period.label}"`,
    metadata: { operator_id: operatorId, type, amount: amountNum },
  }).catch((err) => console.error("recordActivity failed for payroll_adjustment_added", err));

  return NextResponse.json(adjustment, { status: 201 });
}
