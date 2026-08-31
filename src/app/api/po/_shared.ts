import type { D1Database } from "@cloudflare/workers-types";
import { decimalToNumber } from "@/lib/utils";

export type PoRow = {
  id: number;
  nomor_po: string;
  barcode_po: string;
  nama_po: string;
  nama_artikel: string;
  harga_satuan: number;
  target_qty: number | null;
  status: string;
  label: string | null;
  due_date: string | null;
  description: string | null;
  created_by: number;
  createdAt: string;
  creator_nama_lengkap: string | null;
};

export type PoArticleRow = {
  id: number;
  po_id: number;
  artikel_id: number | null;
  nama_artikel: string;
  harga_satuan: number;
  qty: number | null;
  createdAt: string;
};

export type PoAttachmentRow = {
  id: number;
  po_id: number;
  file_name: string;
  file_url: string;
  is_cover: number;
  createdAt: string;
};

export type ActivityLogRow = {
  id: number;
  user_id: number | null;
  entity: string;
  entity_id: number | null;
  action: string;
  summary: string;
  metadata: string | null;
  createdAt: string;
};

export type PoMemberRow = {
  id: number;
  po_id: number;
  user_id: number;
  nama_lengkap: string;
  username: string;
};

export type PoChecklistItemRow = {
  id: number;
  po_id: number;
  text: string;
  is_done: number;
  createdAt: string;
};

export type PoAddOnRow = {
  id: number;
  po_id: number;
  po_article_id: number | null;
  addon_id: number | null;
  nama_addon: string;
  harga_addon: number;
  createdAt: string;
};

export const PO_SELECT = `
  SELECT po.*, u.nama_lengkap AS creator_nama_lengkap
  FROM purchase_orders po
  LEFT JOIN users u ON u.id = po.created_by
`;

/** Builds a `col IN (?1,?2,...)` fragment plus the matching bind values. */
export function inClause(ids: number[], startIndex = 1) {
  const placeholders = ids.map((_, i) => `?${startIndex + i}`).join(",");
  return { placeholders, values: ids };
}

/** Loads articles/attachments/activity-logs for a set of PO ids and groups them by po_id. */
export async function loadPoRelations(db: D1Database, poIds: number[]) {
  if (poIds.length === 0) {
    return {
      articlesByPo: new Map<number, PoArticleRow[]>(),
      attachmentsByPo: new Map<number, PoAttachmentRow[]>(),
      logsByPo: new Map<number, ActivityLogRow[]>(),
      membersByPo: new Map<number, PoMemberRow[]>(),
      checklistByPo: new Map<number, PoChecklistItemRow[]>(),
      addOnsByPo: new Map<number, PoAddOnRow[]>(),
    };
  }

  const { placeholders, values } = inClause(poIds);

  // Promise.allSettled (not all): if the newer po_members/po_checklist_items/
  // purchase_order_addons tables haven't been migrated yet on this
  // environment, we still want the core PO list (articles/attachments/logs)
  // to load instead of the whole request failing with a 500.
  const [articlesResult, attachmentsResult, logsResult, membersResult, checklistResult, addOnsResult] = await Promise.allSettled([
    db
      .prepare(`SELECT * FROM purchase_order_articles WHERE po_id IN (${placeholders}) ORDER BY id ASC`)
      .bind(...values)
      .all<PoArticleRow>(),
    db
      .prepare(`SELECT * FROM purchase_order_attachments WHERE po_id IN (${placeholders}) ORDER BY "createdAt" DESC`)
      .bind(...values)
      .all<PoAttachmentRow>(),
    db
      .prepare(
        `SELECT * FROM activity_logs WHERE entity = 'po' AND entity_id IN (${placeholders}) ORDER BY "createdAt" DESC LIMIT 300`
      )
      .bind(...values)
      .all<ActivityLogRow>(),
    db
      .prepare(
        `SELECT pm.id, pm.po_id, pm.user_id, u.nama_lengkap, u.username
         FROM po_members pm JOIN users u ON u.id = pm.user_id
         WHERE pm.po_id IN (${placeholders}) ORDER BY pm.id ASC`
      )
      .bind(...values)
      .all<PoMemberRow>(),
    db
      .prepare(`SELECT * FROM po_checklist_items WHERE po_id IN (${placeholders}) ORDER BY id ASC`)
      .bind(...values)
      .all<PoChecklistItemRow>(),
    db
      .prepare(`SELECT * FROM purchase_order_addons WHERE po_id IN (${placeholders}) ORDER BY id ASC`)
      .bind(...values)
      .all<PoAddOnRow>(),
  ]);

  const settled = <T,>(result: PromiseSettledResult<{ results?: T[] }>, label: string): T[] => {
    if (result.status === "fulfilled") return result.value.results ?? [];
    console.error(`loadPoRelations: ${label} query failed (table may not be migrated yet)`, result.reason);
    return [];
  };

  const articlesByPo = new Map<number, PoArticleRow[]>();
  for (const row of settled(articlesResult, "purchase_order_articles")) {
    const list = articlesByPo.get(row.po_id) ?? [];
    list.push(row);
    articlesByPo.set(row.po_id, list);
  }

  const attachmentsByPo = new Map<number, PoAttachmentRow[]>();
  for (const row of settled(attachmentsResult, "purchase_order_attachments")) {
    const list = attachmentsByPo.get(row.po_id) ?? [];
    list.push(row);
    attachmentsByPo.set(row.po_id, list);
  }

  const logsByPo = new Map<number, ActivityLogRow[]>();
  for (const row of settled(logsResult, "activity_logs")) {
    if (row.entity_id === null) continue;
    const list = logsByPo.get(row.entity_id) ?? [];
    list.push(row);
    logsByPo.set(row.entity_id, list);
  }

  const membersByPo = new Map<number, PoMemberRow[]>();
  for (const row of settled(membersResult, "po_members")) {
    const list = membersByPo.get(row.po_id) ?? [];
    list.push(row);
    membersByPo.set(row.po_id, list);
  }

  const checklistByPo = new Map<number, PoChecklistItemRow[]>();
  for (const row of settled(checklistResult, "po_checklist_items")) {
    const list = checklistByPo.get(row.po_id) ?? [];
    list.push(row);
    checklistByPo.set(row.po_id, list);
  }

  const addOnsByPo = new Map<number, PoAddOnRow[]>();
  for (const row of settled(addOnsResult, "purchase_order_addons")) {
    const list = addOnsByPo.get(row.po_id) ?? [];
    list.push(row);
    addOnsByPo.set(row.po_id, list);
  }

  return { articlesByPo, attachmentsByPo, logsByPo, membersByPo, checklistByPo, addOnsByPo };
}

/** Shapes a raw PO row (+ preloaded relations) into the nested JSON shape the frontend expects. */
export function serializePo(
  po: PoRow,
  relations: {
    articles?: PoArticleRow[];
    attachments?: PoAttachmentRow[];
    activityLogs?: ActivityLogRow[];
    members?: PoMemberRow[];
    checklistItems?: PoChecklistItemRow[];
    addOns?: PoAddOnRow[];
  }
) {
  const { creator_nama_lengkap, ...rest } = po;
  const addOns = relations.addOns ?? [];
  const addOnsByArticle = new Map<number, PoAddOnRow[]>();
  for (const addon of addOns) {
    if (addon.po_article_id == null) continue;
    const list = addOnsByArticle.get(addon.po_article_id) ?? [];
    list.push(addon);
    addOnsByArticle.set(addon.po_article_id, list);
  }

  return {
    ...rest,
    harga_satuan: decimalToNumber(po.harga_satuan),
    creator: { nama_lengkap: creator_nama_lengkap },
    articles: (relations.articles ?? []).map((article) => ({
      ...article,
      harga_satuan: decimalToNumber(article.harga_satuan),
      addOns: (addOnsByArticle.get(article.id) ?? []).map((addon) => ({
        ...addon,
        harga_addon: decimalToNumber(addon.harga_addon),
      })),
    })),
    attachments: (relations.attachments ?? []).map((attachment) => ({
      ...attachment,
      is_cover: !!attachment.is_cover,
    })),
    activityLogs: relations.activityLogs ?? [],
    members: (relations.members ?? []).map((member) => ({
      id: member.id,
      user_id: member.user_id,
      nama_lengkap: member.nama_lengkap,
      username: member.username,
    })),
    checklistItems: (relations.checklistItems ?? []).map((item) => ({
      ...item,
      is_done: !!item.is_done,
    })),
    // Daftar gabungan semua add-on di PO ini (lintas artikel) — dipertahankan
    // untuk kompatibilitas & laporan; untuk breakdown per artikel pakai
    // articles[i].addOns.
    addOns: addOns.map((addon) => ({
      ...addon,
      harga_addon: decimalToNumber(addon.harga_addon),
    })),
  };
}
