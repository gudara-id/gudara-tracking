import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";

function canAccessPayroll(role: string) {
  return role === "admin_produksi" || role === "admin_jahit";
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !canAccessPayroll(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adjustmentId = Number((await params).id);
  if (!adjustmentId) return NextResponse.json({ error: "ID adjustment tidak valid" }, { status: 400 });

  const db = getDB();
  const existing = await db
    .prepare(
      `SELECT a.*, o.nama_operator FROM payroll_adjustments a JOIN operators o ON o.id = a.operator_id WHERE a.id = ?1`
    )
    .bind(adjustmentId)
    .first<{ id: number; period_id: number; label: string; type: string; amount: number; nama_operator: string }>();
  if (!existing) return NextResponse.json({ error: "Adjustment tidak ditemukan" }, { status: 404 });

  await db.prepare(`DELETE FROM payroll_adjustments WHERE id = ?1`).bind(adjustmentId).run();

  await recordActivity({
    session,
    entity: "payroll",
    entityId: existing.period_id,
    action: "payroll_adjustment_removed",
    summary: `${session.nama_lengkap} menghapus ${existing.type === "bonus" ? "bonus" : "potongan"} "${existing.label}" milik ${existing.nama_operator}`,
  }).catch((err) => console.error("recordActivity failed for payroll_adjustment_removed", err));

  return NextResponse.json({ ok: true });
}
