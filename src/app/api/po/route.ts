import { NextRequest, NextResponse } from "next/server";
import type { D1Database } from "@cloudflare/workers-types";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { generatePoIdentifiers, LEGACY_PO_STATUSES, CANCELLED_PO_STATUS } from "@/lib/validators";
import { recordActivity } from "@/lib/activity";
import { PO_SELECT, loadPoRelations, serializePo, type PoRow, type PoArticleRow, type PoAddOnRow } from "./_shared";

/** A status is valid if it's a legacy value ("berjalan"/"selesai"), the special
 * cancelled status, or matches a configured production stage. */
async function isValidStatus(db: D1Database, status: string) {
  if ((LEGACY_PO_STATUSES as readonly string[]).includes(status)) return true;
  if (status === CANCELLED_PO_STATUS) return true;
  try {
    const row = await db.prepare(`SELECT 1 FROM production_stages WHERE nama = ?1`).bind(status).first();
    return !!row;
  } catch (err) {
    // production_stages not migrated yet on this environment — don't block PO moves because of it.
    console.error("isValidStatus: production_stages query failed (table may not be migrated yet)", err);
    return true;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDB();
    const { results: pos } = await db.prepare(`${PO_SELECT} ORDER BY po."createdAt" DESC`).all<PoRow>();
    const poRows = pos ?? [];

    const { articlesByPo, attachmentsByPo, logsByPo, membersByPo, checklistByPo, addOnsByPo } = await loadPoRelations(
      db,
      poRows.map((po) => po.id)
    );

    return NextResponse.json(
      poRows.map((po) =>
        serializePo(po, {
          articles: articlesByPo.get(po.id),
          attachments: attachmentsByPo.get(po.id),
          activityLogs: logsByPo.get(po.id),
          members: membersByPo.get(po.id),
          checklistItems: checklistByPo.get(po.id),
          addOns: addOnsByPo.get(po.id),
        })
      ),
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (err: unknown) {
    console.error("GET /api/po failed", err);
    return NextResponse.json({ error: "Gagal memuat data PO" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_operasional") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { nama_po, nama_artikel, harga_satuan, target_qty, articles = [], label, due_date, description } = body;

  if (!nama_po || !nama_artikel || harga_satuan === undefined || harga_satuan === null) {
    return NextResponse.json({ error: "Nama PO, artikel, dan harga satuan wajib diisi" }, { status: 400 });
  }

  // Tiap baris artikel bisa punya set add-on sendiri (`articles[i].addons`),
  // karena satu PO bisa memuat beberapa artikel berbeda dengan add-on yang
  // berbeda pula. `harga_satuan` per artikel diharapkan sudah berupa harga
  // akhir yang dikirim client (harga dasar + total add-on artikel itu).
  function sanitizeAddOns(raw: unknown): { addon_id: number | null; nama_addon: string; harga_addon: number }[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item: { addon_id?: number | null; nama_addon?: string; harga_addon?: number }) => ({
        addon_id: item.addon_id || null,
        nama_addon: String(item.nama_addon ?? "").trim(),
        harga_addon: Number(item.harga_addon),
      }))
      .filter((item) => item.nama_addon && Number.isFinite(item.harga_addon) && item.harga_addon > 0);
  }

  const hargaNum = Number(harga_satuan);
  const targetNum = target_qty ? Number(target_qty) : null;
  if (!Number.isFinite(hargaNum) || hargaNum <= 0) {
    return NextResponse.json({ error: "Harga satuan harus lebih dari 0" }, { status: 400 });
  }
  if (targetNum !== null && (!Number.isInteger(targetNum) || targetNum <= 0)) {
    return NextResponse.json({ error: "Target QTY harus berupa angka bulat lebih dari 0" }, { status: 400 });
  }

  try {
    const db = getDB();

    // New PO always lands in whichever stage is currently first on the
    // board (Konfigurasi > Tahapan Produksi controls that order), so
    // renaming/reordering stages doesn't strand new PO on a stale name.
    let initialStatus = "PRINT PO TINGKING";
    try {
      const firstStage = await db
        .prepare(`SELECT nama FROM production_stages ORDER BY urutan ASC LIMIT 1`)
        .first<{ nama: string }>();
      if (firstStage?.nama) initialStatus = firstStage.nama;
    } catch (err) {
      console.error("POST /api/po: could not read production_stages, falling back to default stage", err);
    }

    const countRow = await db.prepare(`SELECT COUNT(*) as count FROM purchase_orders`).first<{ count: number }>();
    const { nomor_po, barcode_po } = generatePoIdentifiers((countRow?.count ?? 0) + 1);

    const articleRows: {
      artikel_id?: number;
      nama_artikel: string;
      harga_satuan: number;
      qty?: number | null;
      addons?: unknown;
    }[] = Array.isArray(articles) && articles.length ? articles : [{ nama_artikel, harga_satuan: hargaNum, qty: targetNum }];

    const created = await db
      .prepare(
        `INSERT INTO purchase_orders
          (nomor_po, barcode_po, nama_po, nama_artikel, harga_satuan, target_qty, status, label, due_date, description, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         RETURNING *`
      )
      .bind(
        nomor_po,
        barcode_po,
        nama_po,
        nama_artikel,
        hargaNum,
        targetNum,
        initialStatus,
        label || null,
        due_date ? new Date(due_date).toISOString() : null,
        description || null,
        session.userId
      )
      .first<Omit<PoRow, "creator_nama_lengkap">>();

    if (!created) {
      return NextResponse.json({ error: "Gagal membuat PO" }, { status: 500 });
    }

    const articleInserts = articleRows.map((item) =>
      db
        .prepare(
          `INSERT INTO purchase_order_articles (po_id, artikel_id, nama_artikel, harga_satuan, qty) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING *`
        )
        .bind(created.id, item.artikel_id || null, item.nama_artikel, Number(item.harga_satuan), item.qty ? Number(item.qty) : null)
    );
    const articleResults = await db.batch<PoArticleRow>(articleInserts);
    const insertedArticles = articleResults
      .map((r) => r.results?.[0])
      .filter((row): row is PoArticleRow => !!row);

    let insertedAddOns: PoAddOnRow[] = [];
    try {
      const addonInserts: ReturnType<typeof db.prepare>[] = [];
      insertedArticles.forEach((article, idx) => {
        const rowAddOns = sanitizeAddOns(articleRows[idx]?.addons);
        for (const item of rowAddOns) {
          addonInserts.push(
            db
              .prepare(
                `INSERT INTO purchase_order_addons (po_id, po_article_id, addon_id, nama_addon, harga_addon) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING *`
              )
              .bind(created.id, article.id, item.addon_id, item.nama_addon, item.harga_addon)
          );
        }
      });
      if (addonInserts.length > 0) {
        const addonResults = await db.batch<PoAddOnRow>(addonInserts);
        insertedAddOns = addonResults.map((r) => r.results?.[0]).filter((row): row is PoAddOnRow => !!row);
      }
    } catch (err) {
      // purchase_order_addons / po_article_id not migrated yet on this
      // environment — don't fail the whole PO creation because of it.
      console.error("POST /api/po: failed to save add-ons (table may not be migrated yet)", err);
    }

    const po: PoRow = { ...created, creator_nama_lengkap: session.nama_lengkap };

    await recordActivity({
      session,
      entity: "po",
      entityId: po.id,
      action: "po_created",
      summary: `${session.nama_lengkap} membuat PO ${po.nomor_po}`,
      metadata: { nomor_po, status: po.status },
    }).catch((err) => console.error("recordActivity failed for po_created", err));

    return NextResponse.json(
      serializePo(po, { articles: insertedArticles, attachments: [], activityLogs: [], addOns: insertedAddOns }),
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST /api/po failed", err);
    return NextResponse.json({ error: "Gagal menyimpan PO ke database" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !["admin_operasional", "operator_produksi", "kurir"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isAdmin = session.role === "admin_operasional";
  const isKurir = session.role === "kurir";

  const body = await req.json();
  const { id, status, label, due_date, description, attachment } = body;
  if (!id) {
    return NextResponse.json({ error: "ID PO wajib diisi" }, { status: 400 });
  }

  // Operator Produksi & Kurir hanya boleh memindahkan tahapan PO (dan untuk
  // Kurir, melampirkan foto bukti pengiriman) — tidak boleh mengubah
  // label/due date/deskripsi PO seperti admin_operasional.
  if (!isAdmin) {
    if (label !== undefined || due_date !== undefined || description !== undefined) {
      return NextResponse.json({ error: "Anda hanya bisa mengubah tahapan PO ini" }, { status: 403 });
    }
    if (attachment !== undefined && !isKurir) {
      return NextResponse.json({ error: "Anda tidak bisa menambah lampiran" }, { status: 403 });
    }
  }

  try {
    const db = getDB();

    if (status && !(await isValidStatus(db, status))) {
      return NextResponse.json({ error: "Status/tahapan tidak valid" }, { status: 400 });
    }

    // Membatalkan (atau memulihkan dari) PO hanya boleh dilakukan admin
    // produksi — operator/kurir cuma boleh menggeser PO antar tahapan biasa.
    if (status === CANCELLED_PO_STATUS && !isAdmin) {
      return NextResponse.json({ error: "Hanya admin produksi yang bisa membatalkan PO" }, { status: 403 });
    }

    // Kurir hanya menandai PO sebagai sudah terkirim — hanya boleh
    // memindahkan status ke tahapan FINAL (tahapan terakhir yang
    // dikonfigurasi, atau "TERKIRIM"/"selesai" untuk kompatibilitas lama).
    if (isKurir && status) {
      const { results: stages } = await db.prepare(`SELECT nama FROM production_stages ORDER BY urutan ASC`).all<{ nama: string }>();
      const finalStage = stages?.length ? stages[stages.length - 1].nama : "TERKIRIM";
      if (status !== finalStage && status !== "TERKIRIM" && status !== "selesai") {
        return NextResponse.json({ error: "Kurir hanya bisa menandai PO sebagai sudah terkirim" }, { status: 403 });
      }
    }

    const poId = Number(id);

    const previousPo = await db
      .prepare(`SELECT * FROM purchase_orders WHERE id = ?1`)
      .bind(poId)
      .first<Omit<PoRow, "creator_nama_lengkap">>();
    if (!previousPo) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });

    // PO yang sudah dibatalkan dikunci dari board normal — hanya admin yang
    // boleh memulihkannya (atau mengubah apa pun lagi padanya).
    if (previousPo.status === CANCELLED_PO_STATUS && !isAdmin) {
      return NextResponse.json({ error: "PO ini sudah dibatalkan. Hubungi admin produksi untuk memulihkannya" }, { status: 403 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (status) {
      sets.push(`status = ?${i++}`);
      values.push(status);
    }
    if (label !== undefined) {
      sets.push(`label = ?${i++}`);
      values.push(label || null);
    }
    if (due_date !== undefined) {
      sets.push(`due_date = ?${i++}`);
      values.push(due_date ? new Date(due_date).toISOString() : null);
    }
    if (description !== undefined) {
      sets.push(`description = ?${i++}`);
      values.push(description || null);
    }

    const hasAttachment = !!(attachment?.file_name && attachment?.file_url);
    if (hasAttachment && String(attachment.file_url).startsWith("data:image/") && String(attachment.file_url).length > 700_000) {
      return NextResponse.json({ error: "Ukuran foto terlalu besar" }, { status: 400 });
    }

    const statements = [];
    if (sets.length > 0) {
      values.push(poId);
      statements.push(db.prepare(`UPDATE purchase_orders SET ${sets.join(", ")} WHERE id = ?${i}`).bind(...values));
    }
    if (hasAttachment) {
      statements.push(
        db
          .prepare(`INSERT INTO purchase_order_attachments (po_id, file_name, file_url, is_cover) VALUES (?1, ?2, ?3, ?4)`)
          .bind(poId, attachment.file_name, attachment.file_url, attachment.is_cover ? 1 : 0)
      );
    }
    if (statements.length > 0) {
      await db.batch(statements);
    }

    const updated = await db
      .prepare(`SELECT * FROM purchase_orders WHERE id = ?1`)
      .bind(poId)
      .first<Omit<PoRow, "creator_nama_lengkap">>();
    if (!updated) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });

    const creatorRow = await db
      .prepare(`SELECT nama_lengkap FROM users WHERE id = ?1`)
      .bind(updated.created_by)
      .first<{ nama_lengkap: string }>();

    const po: PoRow = { ...updated, creator_nama_lengkap: creatorRow?.nama_lengkap ?? null };

    const changes: string[] = [];
    if (status && status !== previousPo.status) changes.push(`status ${previousPo.status} -> ${status}`);
    if (label !== undefined && (label || null) !== previousPo.label) changes.push("label");
    if (due_date !== undefined) changes.push("due date");
    if (description !== undefined && (description || null) !== previousPo.description) changes.push("deskripsi");
    if (hasAttachment) changes.push(`attachment ${attachment.file_name}`);
    if (changes.length) {
      const justCancelled = status === CANCELLED_PO_STATUS && previousPo.status !== CANCELLED_PO_STATUS;
      const justRestored = previousPo.status === CANCELLED_PO_STATUS && status && status !== CANCELLED_PO_STATUS;
      const action = justCancelled
        ? "po_cancelled"
        : justRestored
          ? "po_restored"
          : status && status !== previousPo.status
            ? "po_status_changed"
            : "po_updated";
      const summary = justCancelled
        ? `${session.nama_lengkap} membatalkan PO ${po.nomor_po}`
        : justRestored
          ? `${session.nama_lengkap} memulihkan PO ${po.nomor_po} ke ${status}`
          : `${session.nama_lengkap} mengubah ${changes.join(", ")} pada ${po.nomor_po}`;

      // Record BEFORE loading relations below, so the freshly-written log
      // entry is included in the activityLogs we send back — otherwise the
      // client (which replaces its local PO object with this response) would
      // momentarily show a stale/incomplete log list.
      await recordActivity({
        session,
        entity: "po",
        entityId: po.id,
        action,
        summary,
        metadata: { beforeStatus: previousPo.status, afterStatus: po.status, changes },
      }).catch((err) => console.error("recordActivity failed for po_updated", err));
    }

    // Load relations (articles/attachments/activity logs/members/checklist)
    // AFTER recording the activity above, and — critically — actually pass the
    // loaded activity logs back to the client. Previously this endpoint always
    // returned activityLogs: [], and since the frontend replaces its local PO
    // object with this response on every update (including board drag/drop),
    // that wiped out the whole visible log history every time a PO moved.
    const { articlesByPo, attachmentsByPo, logsByPo, membersByPo, checklistByPo, addOnsByPo } = await loadPoRelations(db, [poId]);

    return NextResponse.json(
      serializePo(po, {
      articles: articlesByPo.get(poId),
      attachments: attachmentsByPo.get(poId),
      activityLogs: logsByPo.get(poId),
      members: membersByPo.get(poId),
      checklistItems: checklistByPo.get(poId),
      addOns: addOnsByPo.get(poId),
    })
    );
  } catch (err: unknown) {
    console.error("PATCH /api/po failed", err);
    return NextResponse.json({ error: "Gagal menyimpan perubahan PO" }, { status: 500 });
  }
}

/** Menghapus PO secara permanen. Hanya admin_operasional, dan hanya untuk PO
 * yang belum punya data setoran/produksi terkait (dijaga oleh FK RESTRICT
 * di tabel setoran_jahit) — kalau sudah ada, sarankan Batalkan saja supaya
 * histori produksi tidak hilang. */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_operasional") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "ID PO wajib diisi" }, { status: 400 });
  }

  try {
    const db = getDB();
    const po = await db
      .prepare(`SELECT * FROM purchase_orders WHERE id = ?1`)
      .bind(id)
      .first<Omit<PoRow, "creator_nama_lengkap">>();
    if (!po) return NextResponse.json({ error: "PO tidak ditemukan" }, { status: 404 });

    await db.prepare(`DELETE FROM purchase_orders WHERE id = ?1`).bind(id).run();

    await recordActivity({
      session,
      entity: "po",
      entityId: id,
      action: "po_deleted",
      summary: `${session.nama_lengkap} menghapus permanen PO ${po.nomor_po}`,
      metadata: { nomor_po: po.nomor_po, status: po.status },
    }).catch((err) => console.error("recordActivity failed for po_deleted", err));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/po failed", err);
    const message = String((err as { message?: string })?.message || "");
    if (message.toUpperCase().includes("FOREIGN KEY") || message.toUpperCase().includes("CONSTRAINT")) {
      return NextResponse.json(
        {
          error:
            "PO ini tidak bisa dihapus permanen karena sudah punya data setoran/produksi terkait. Gunakan tombol Batalkan sebagai gantinya agar histori produksi tetap tersimpan.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Gagal menghapus PO" }, { status: 500 });
  }
}
