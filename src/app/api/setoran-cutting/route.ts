import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import type { D1Database } from "@cloudflare/workers-types";

// Alur & bentuk API ini sengaja dibuat sama persis dengan /api/setoran
// (setoran_jahit) — bedanya cutting tidak menyimpan harga_satuan/total_upah
// karena saat ini tidak dihitung borongan per pcs. Lihat prisma/schema.prisma
// di model SetoranCutting untuk catatan lebih lengkap.

type SetoranCuttingRow = {
  id: number;
  tanggal_setoran: string; // ISO 8601 string, as Prisma writes SQLite DateTime columns
  operator_id: number;
  po_id: number;
  qty_disetor: number;
  qty_reject: number;
  catatan_reject: string | null;
  admin_cutting_id: number;
  foto_url: string | null;
  operator_nama_operator: string;
  po_nama_po: string;
  po_nama_artikel: string;
  admin_nama_lengkap: string;
};

const SETORAN_CUTTING_SELECT = `
  SELECT
    s.*,
    o.nama_operator AS operator_nama_operator,
    po.nama_po AS po_nama_po,
    po.nama_artikel AS po_nama_artikel,
    u.nama_lengkap AS admin_nama_lengkap
  FROM setoran_cutting s
  JOIN operators o ON o.id = s.operator_id
  JOIN purchase_orders po ON po.id = s.po_id
  JOIN users u ON u.id = s.admin_cutting_id
`;

function serializeSetoranCutting(row: SetoranCuttingRow) {
  return {
    id: row.id,
    tanggal_setoran: row.tanggal_setoran,
    operator_id: row.operator_id,
    po_id: row.po_id,
    qty_disetor: row.qty_disetor,
    qty_reject: row.qty_reject ?? 0,
    catatan_reject: row.catatan_reject ?? null,
    admin_cutting_id: row.admin_cutting_id,
    foto_url: row.foto_url ?? null,
    operator: { nama_operator: row.operator_nama_operator },
    po: { nama_po: row.po_nama_po, nama_artikel: row.po_nama_artikel },
    adminCutting: { nama_lengkap: row.admin_nama_lengkap },
  };
}

/** Resolves the request's start/date/range query params into an inclusive day range, matching /api/setoran exactly. */
function resolveDateRange(req: NextRequest) {
  const startParam = req.nextUrl.searchParams.get("start");
  const endParam = req.nextUrl.searchParams.get("end");
  const dateParam = req.nextUrl.searchParams.get("date");

  const rangeStartSource = startParam ? new Date(startParam) : dateParam ? new Date(dateParam) : new Date();
  const rangeEndSource = endParam ? new Date(endParam) : rangeStartSource;

  const startOfDay = new Date(rangeStartSource);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(rangeEndSource);
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
}

async function queryEntries(db: D1Database, req: NextRequest, order: "asc" | "desc") {
  const { startOfDay, endOfDay } = resolveDateRange(req);
  const operatorIdParam = req.nextUrl.searchParams.get("operator_id");

  const values: unknown[] = [startOfDay.toISOString(), endOfDay.toISOString()];
  let where = `s.tanggal_setoran >= ?1 AND s.tanggal_setoran <= ?2`;
  if (operatorIdParam) {
    values.push(Number(operatorIdParam));
    where += ` AND s.operator_id = ?${values.length}`;
  }

  const { results } = await db
    .prepare(`${SETORAN_CUTTING_SELECT} WHERE ${where} ORDER BY s.tanggal_setoran ${order === "asc" ? "ASC" : "DESC"}`)
    .bind(...values)
    .all<SetoranCuttingRow>();

  return results ?? [];
}

// GET /api/setoran-cutting?date=2026-08-04                (single day, defaults to today)
// GET /api/setoran-cutting?start=2026-08-03&end=2026-08-08 (date range, inclusive)
// GET /api/setoran-cutting?...&operator_id=5                (optional: filter satu operator)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB();
  const rows = await queryEntries(db, req, "desc");

  return NextResponse.json(rows.map(serializeSetoranCutting));
}

type PoForSetoran = {
  id: number;
  nama_po: string;
  nomor_po: string;
  nama_artikel: string;
  status: string;
  target_qty: number | null;
};

// POST - the scanner submits { operator_id, po_id, qty_disetor }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_cutting") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { operator_id, po_id, qty_disetor, qty_reject, catatan_reject, foto_url } = await req.json();

  const qty = Number(qty_disetor);
  // qty_reject optional; defaults to 0 pcs cacat. Sama seperti setoran jahit,
  // ini murni dicatat untuk keperluan QC, tidak mengurangi qty_disetor.
  const qtyReject = qty_reject === undefined || qty_reject === null || qty_reject === "" ? 0 : Number(qty_reject);
  const catatanReject = String(catatan_reject ?? "").trim() || null;

  // foto_url datang sebagai data URL base64 (sudah dikompres di sisi client,
  // lihat InputSetoranCuttingModal). Batasi ukurannya di server juga.
  let fotoUrl: string | null = typeof foto_url === "string" ? foto_url.trim() || null : null;
  if (fotoUrl && !fotoUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Format foto tidak valid" }, { status: 400 });
  }
  if (fotoUrl && fotoUrl.length > 700_000) {
    return NextResponse.json({ error: "Ukuran foto terlalu besar" }, { status: 400 });
  }

  if (!operator_id || !po_id || !Number.isInteger(qty) || qty <= 0) {
    return NextResponse.json({ error: "Data tidak lengkap atau QTY tidak valid" }, { status: 400 });
  }
  if (!Number.isInteger(qtyReject) || qtyReject < 0) {
    return NextResponse.json({ error: "QTY reject harus berupa angka bulat 0 atau lebih" }, { status: 400 });
  }
  if (qtyReject > 0 && !catatanReject) {
    return NextResponse.json({ error: "Catatan alasan reject wajib diisi kalau ada QTY reject" }, { status: 400 });
  }

  const db = getDB();

  const [operator, po] = await Promise.all([
    db
      .prepare(`SELECT id, nama_operator, status FROM operators WHERE id = ?1`)
      .bind(Number(operator_id))
      .first<{ id: number; nama_operator: string; status: string }>(),
    db
      .prepare(`SELECT id, nama_po, nomor_po, nama_artikel, status, target_qty FROM purchase_orders WHERE id = ?1`)
      .bind(Number(po_id))
      .first<PoForSetoran>(),
  ]);

  if (!operator) return NextResponse.json({ error: "Operator tidak ditemukan" }, { status: 404 });
  if (!po) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });
  if (operator.status !== "aktif") {
    return NextResponse.json({ error: `Operator "${operator.nama_operator}" berstatus non-aktif` }, { status: 409 });
  }
  if (po.status === "selesai" || po.status === "TERKIRIM") {
    return NextResponse.json({ error: `PO "${po.nama_po}" sudah berstatus selesai` }, { status: 409 });
  }

  const created = await db
    .prepare(
      `INSERT INTO setoran_cutting (operator_id, po_id, qty_disetor, qty_reject, catatan_reject, admin_cutting_id, foto_url)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       RETURNING *`
    )
    .bind(operator.id, po.id, qty, qtyReject, catatanReject, session.userId, fotoUrl)
    .first<{
      id: number;
      tanggal_setoran: string;
      operator_id: number;
      po_id: number;
      qty_disetor: number;
      qty_reject: number;
      catatan_reject: string | null;
      admin_cutting_id: number;
      foto_url: string | null;
    }>();

  if (!created) {
    return NextResponse.json({ error: "Gagal menyimpan data cutting" }, { status: 500 });
  }

  const [totalCuttingRow, totalJahitRow] = await Promise.all([
    db
      .prepare(`SELECT COALESCE(SUM(qty_disetor), 0) AS total FROM setoran_cutting WHERE po_id = ?1`)
      .bind(po.id)
      .first<{ total: number }>(),
    db
      .prepare(`SELECT COALESCE(SUM(qty_disetor), 0) AS total FROM setoran_jahit WHERE po_id = ?1`)
      .bind(po.id)
      .first<{ total: number }>(),
  ]);
  const totalCutting = totalCuttingRow?.total ?? qty;
  const totalJahit = totalJahitRow?.total ?? 0;
  const progressLabel = po.target_qty ? `${totalCutting}/${po.target_qty} pcs` : `${totalCutting} pcs`;
  const selisih = totalCutting - totalJahit;

  await recordActivity({
    session,
    entity: "setoran",
    entityId: created.id,
    action: "setoran_cutting_created",
    summary:
      `${session.nama_lengkap} input cutting ${qty} pcs untuk ${operator.nama_operator} pada ${po.nama_po}` +
      (qtyReject > 0 ? ` (${qtyReject} pcs reject: ${catatanReject})` : ""),
    metadata: {
      operator_id: operator.id,
      operator: operator.nama_operator,
      po_id: po.id,
      nomor_po: po.nomor_po,
      qty,
      qty_reject: qtyReject,
      catatan_reject: catatanReject,
    },
  });

  // Log juga terhadap PO itu sendiri supaya muncul di feed "Aktivitas dan
  // Status" pada kartu PO di papan produksi, berdampingan dengan log setoran
  // jahit — jadi admin produksi bisa langsung lihat kedua alur di satu
  // tempat dan menyadari kalau totalnya belum sama persis.
  await recordActivity({
    session,
    entity: "po",
    entityId: po.id,
    action: "setoran_cutting_created",
    summary:
      `${session.nama_lengkap} input cutting ${qty} pcs dari ${operator.nama_operator} — progress cutting ${progressLabel}` +
      (qtyReject > 0 ? ` (${qtyReject} pcs reject)` : "") +
      (selisih !== 0 ? ` — selisih ${selisih > 0 ? "+" : ""}${selisih} pcs dari total jahit (${totalJahit} pcs)` : " — sudah sama dengan total jahit"),
    metadata: {
      operator_id: operator.id,
      operator: operator.nama_operator,
      setoran_cutting_id: created.id,
      qty,
      qty_reject: qtyReject,
      total_cutting: totalCutting,
      total_jahit: totalJahit,
      target_qty: po.target_qty,
    },
  });

  return NextResponse.json(
    serializeSetoranCutting({
      ...created,
      operator_nama_operator: operator.nama_operator,
      po_nama_po: po.nama_po,
      po_nama_artikel: po.nama_artikel,
      admin_nama_lengkap: session.nama_lengkap,
    }),
    { status: 201 }
  );
}
