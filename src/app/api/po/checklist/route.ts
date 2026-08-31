import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";

type ChecklistRow = { id: number; po_id: number; text: string; is_done: number; createdAt: string };

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { po_id, text } = await req.json();
  const poId = Number(po_id);
  const trimmed = String(text ?? "").trim();
  if (!poId || !trimmed) {
    return NextResponse.json({ error: "PO dan teks checklist wajib diisi" }, { status: 400 });
  }

  try {
    const db = getDB();
    const po = await db.prepare(`SELECT id FROM purchase_orders WHERE id = ?1`).bind(poId).first();
    if (!po) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });

    const item = await db
      .prepare(`INSERT INTO po_checklist_items (po_id, text, is_done) VALUES (?1, ?2, 0) RETURNING *`)
      .bind(poId, trimmed)
      .first<ChecklistRow>();

    return NextResponse.json({ ...item, is_done: !!item?.is_done }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/po/checklist failed", err);
    return NextResponse.json(
      { error: "Gagal menambah checklist. Pastikan migrasi database (po_checklist_items) sudah dijalankan." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !["admin_produksi", "operator_produksi"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isAdmin = session.role === "admin_produksi";

  const { id, is_done, text } = await req.json();
  const itemId = Number(id);
  if (!itemId) return NextResponse.json({ error: "ID checklist wajib diisi" }, { status: 400 });

  // Operator Produksi hanya boleh mencentang/batal centang, tidak mengubah teks.
  if (!isAdmin && text !== undefined) {
    return NextResponse.json({ error: "Anda hanya bisa mencentang checklist, bukan mengubah teksnya" }, { status: 403 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (is_done !== undefined) {
    sets.push(`is_done = ?${i++}`);
    values.push(is_done ? 1 : 0);
  }
  if (text !== undefined) {
    const trimmed = String(text).trim();
    if (!trimmed) return NextResponse.json({ error: "Teks checklist tidak boleh kosong" }, { status: 400 });
    sets.push(`text = ?${i++}`);
    values.push(trimmed);
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim" }, { status: 400 });
  }

  try {
    const db = getDB();
    values.push(itemId);
    const item = await db
      .prepare(`UPDATE po_checklist_items SET ${sets.join(", ")} WHERE id = ?${i} RETURNING *`)
      .bind(...values)
      .first<ChecklistRow>();

    if (!item) return NextResponse.json({ error: "Checklist item tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ ...item, is_done: !!item.is_done });
  } catch (err: unknown) {
    console.error("PATCH /api/po/checklist failed", err);
    return NextResponse.json({ error: "Gagal mengubah checklist" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID checklist wajib diisi" }, { status: 400 });

  try {
    const db = getDB();
    await db.prepare(`DELETE FROM po_checklist_items WHERE id = ?1`).bind(id).run();
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/po/checklist failed", err);
    return NextResponse.json({ error: "Gagal menghapus checklist" }, { status: 500 });
  }
}
