import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { isOrderStatus } from "@/lib/validators";
import { recordActivity } from "@/lib/activity";

type OrderItemRow = {
  id: number;
  artikel_id: number | null;
  sku_produk_id: number | null;
  sku_produk_sku: string | null;
  nama_artikel: string;
  harga_satuan: number;
  qty: number;
  subtotal: number;
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "sales") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!id) return NextResponse.json({ error: "ID order tidak valid" }, { status: 400 });

  const db = getDB();
  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first();
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });

  const { results: items } = await db
    .prepare(
      `SELECT id, artikel_id, sku_produk_id, sku_produk_sku, nama_artikel, harga_satuan, qty, subtotal
       FROM order_items
       WHERE order_id = ?1
       ORDER BY id ASC`
    )
    .bind(id)
    .all<OrderItemRow>();

  return NextResponse.json({ ...order, items: items ?? [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "sales") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!id) return NextResponse.json({ error: "ID order tidak valid" }, { status: 400 });

  const body = await req.json();
  const { status, dp_amount, deadline, cancel_reason, nama_po, metode_pembayaran } = body as {
    status?: unknown;
    dp_amount?: unknown;
    deadline?: unknown;
    cancel_reason?: unknown;
    nama_po?: unknown;
    metode_pembayaran?: unknown;
  };

  if (status !== undefined && !isOrderStatus(status)) {
    return NextResponse.json({ error: "Status order tidak valid" }, { status: 400 });
  }

  let dpValue: number | undefined;
  if (dp_amount !== undefined) {
    dpValue = Number(dp_amount);
    if (!Number.isFinite(dpValue) || dpValue < 0) {
      return NextResponse.json({ error: "Nominal DP tidak valid" }, { status: 400 });
    }
  }

  let deadlineValue: string | null | undefined;
  if (deadline !== undefined) {
    if (deadline === null || deadline === "") {
      deadlineValue = null;
    } else {
      const parsed = new Date(deadline as string);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Deadline tidak valid" }, { status: 400 });
      }
      deadlineValue = parsed.toISOString();
    }
  }

  const namaPoValue = typeof nama_po === "string" ? nama_po.trim() : undefined;
  const metodePembayaranValue = typeof metode_pembayaran === "string" ? metode_pembayaran.trim() : undefined;

  if (
    status === undefined &&
    dpValue === undefined &&
    deadlineValue === undefined &&
    cancel_reason === undefined &&
    namaPoValue === undefined &&
    metodePembayaranValue === undefined
  ) {
    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim" }, { status: 400 });
  }

  const db = getDB();
  const existing = await db
    .prepare(`SELECT id, nomor_order, status, subtotal, dp_amount FROM orders WHERE id = ?1`)
    .bind(id)
    .first<{ id: number; nomor_order: string; status: string; subtotal: number; dp_amount: number }>();
  if (!existing) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });

  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;
  const logs: string[] = [];

  if (status !== undefined) {
    updates.push(`status = ?${idx}`);
    values.push(status as string);
    idx++;
    logs.push(`status diubah ke "${status}"`);

    // Only stamp confirmed_by/confirmed_at the first time it leaves "baru",
    // so re-changing status later doesn't overwrite who originally confirmed it.
    if (existing.status === "baru" && status !== "baru") {
      updates.push(`confirmed_by = ?${idx}`);
      values.push(session.userId);
      idx++;
      updates.push(`confirmed_at = ?${idx}`);
      values.push(new Date().toISOString());
      idx++;
    }

    // Stamp who cancelled it and when, the first time it becomes "dibatalkan".
    if (status === "dibatalkan" && existing.status !== "dibatalkan") {
      updates.push(`cancelled_by = ?${idx}`);
      values.push(session.userId);
      idx++;
      updates.push(`cancelled_at = ?${idx}`);
      values.push(new Date().toISOString());
      idx++;
    }
  }

  if (cancel_reason !== undefined) {
    updates.push(`cancel_reason = ?${idx}`);
    values.push((cancel_reason as string) || null);
    idx++;
  }

  if (dpValue !== undefined) {
    updates.push(`dp_amount = ?${idx}`);
    values.push(dpValue);
    idx++;
    logs.push(`DP diperbarui menjadi Rp ${Math.round(dpValue).toLocaleString("id-ID")}`);
  }

  if (deadlineValue !== undefined) {
    updates.push(`deadline = ?${idx}`);
    values.push(deadlineValue);
    idx++;
    logs.push(deadlineValue ? `deadline diatur ke ${deadlineValue.slice(0, 10)}` : "deadline dihapus");
  }

  if (namaPoValue !== undefined) {
    updates.push(`nama_po = ?${idx}`);
    values.push(namaPoValue || null);
    idx++;
    logs.push(namaPoValue ? `Nama PO diatur menjadi "${namaPoValue}"` : "Nama PO dihapus");
  }

  if (metodePembayaranValue !== undefined) {
    updates.push(`metode_pembayaran = ?${idx}`);
    values.push(metodePembayaranValue || null);
    idx++;
    logs.push(metodePembayaranValue ? `metode pembayaran diatur ke "${metodePembayaranValue}"` : "metode pembayaran dihapus");
  }

  values.push(id);
  await db.prepare(`UPDATE orders SET ${updates.join(", ")} WHERE id = ?${idx}`).bind(...values).run();

  await recordActivity({
    session,
    entity: "order",
    entityId: id,
    action: status === "dibatalkan" && existing.status !== "dibatalkan" ? "cancelled" : "updated",
    summary: `Order ${existing.nomor_order}: ${logs.join(", ") || "diperbarui"}`,
  });

  const updated = await db.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first();
  return NextResponse.json(updated);
}
