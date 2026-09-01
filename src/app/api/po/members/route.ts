import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";

type MemberRow = { id: number; po_id: number; user_id: number; nama_lengkap: string; username: string };

const MEMBER_SELECT = `
  SELECT pm.id, pm.po_id, pm.user_id, u.nama_lengkap, u.username
  FROM po_members pm JOIN users u ON u.id = pm.user_id
  WHERE pm.po_id = ?1 ORDER BY pm.id ASC
`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_operasional") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { po_id, user_id } = await req.json();
  const poId = Number(po_id);
  const userId = Number(user_id);
  if (!poId || !userId) {
    return NextResponse.json({ error: "PO dan user wajib diisi" }, { status: 400 });
  }

  const db = getDB();

  try {
    const po = await db.prepare(`SELECT id, nomor_po FROM purchase_orders WHERE id = ?1`).bind(poId).first<{ id: number; nomor_po: string }>();
    if (!po) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });

    try {
      await db.prepare(`INSERT INTO po_members (po_id, user_id) VALUES (?1, ?2)`).bind(poId, userId).run();
    } catch (err: unknown) {
      if (String(err).includes("UNIQUE constraint")) {
        return NextResponse.json({ error: "User tersebut sudah menjadi member PO ini" }, { status: 409 });
      }
      throw err;
    }

    const user = await db.prepare(`SELECT nama_lengkap FROM users WHERE id = ?1`).bind(userId).first<{ nama_lengkap: string }>();
    await recordActivity({
      session,
      entity: "po",
      entityId: poId,
      action: "po_member_added",
      summary: `${session.nama_lengkap} menambahkan ${user?.nama_lengkap ?? "member"} ke ${po.nomor_po}`,
    }).catch((err) => console.error("recordActivity failed for po_member_added", err));

    const { results } = await db.prepare(MEMBER_SELECT).bind(poId).all<MemberRow>();
    return NextResponse.json(results ?? [], { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/po/members failed", err);
    return NextResponse.json(
      { error: "Gagal menambah member. Pastikan migrasi database (po_members) sudah dijalankan." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_operasional") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const poId = Number(req.nextUrl.searchParams.get("po_id"));
  const userId = Number(req.nextUrl.searchParams.get("user_id"));
  if (!poId || !userId) {
    return NextResponse.json({ error: "PO dan user wajib diisi" }, { status: 400 });
  }

  const db = getDB();
  try {
    await db.prepare(`DELETE FROM po_members WHERE po_id = ?1 AND user_id = ?2`).bind(poId, userId).run();
    const { results } = await db.prepare(MEMBER_SELECT).bind(poId).all<MemberRow>();
    return NextResponse.json(results ?? []);
  } catch (err: unknown) {
    console.error("DELETE /api/po/members failed", err);
    return NextResponse.json({ error: "Gagal menghapus member" }, { status: 500 });
  }
}
