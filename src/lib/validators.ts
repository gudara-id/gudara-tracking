// Lightweight validators for fields that are DB-typed as String
// (SQLite has no native enum support in Prisma) but are logically
// fixed unions. Kept dependency-free; swap for Zod if you prefer.

export const USER_ROLES = ["admin_produksi", "admin_jahit", "operator_jahit", "operator_produksi", "kurir", "sales"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const OPERATOR_STATUSES = ["aktif", "non-aktif"] as const;
export type OperatorStatus = (typeof OPERATOR_STATUSES)[number];

// Fallback/seed list only. The actual kanban columns are now configurable
// at runtime via the "production_stages" table (CRUD in Konfigurasi >
// Tahapan Produksi, served by /api/tahapan). This constant is used to seed
// that table on first migration and as a client-side fallback while stages
// are still loading — it is NOT the source of truth for valid PO statuses
// anymore. See isPOStatus()/db-backed checks in src/app/api/po/route.ts.
export const KANBAN_PO_STATUSES = [
  "PRINT PO TINGKING",
  "ANTRIAN PRINT RAJA PRINTING",
  "ANTRIAN PRESS",
  "SELESAI PRESS",
  "PO EMBOSS",
  "PROSES CUTTING",
  "SIAP JAHIT",
  "JAHIT",
  "FINISHING / PACKING",
  "SIAP KIRIM",
  "TERKIRIM",
] as const;

/** Special status for a PO that was cancelled mid-production. Not a kanban
 * column/stage — it's tracked separately so a cancelled PO drops off the
 * board instead of being stuck in whatever stage it was cancelled from. */
export const CANCELLED_PO_STATUS = "DIBATALKAN" as const;

export const PO_STATUSES = ["berjalan", "selesai", CANCELLED_PO_STATUS, ...KANBAN_PO_STATUSES] as const;
export type POStatus = (typeof PO_STATUSES)[number];

/** Legacy statuses that are always valid regardless of the configurable stage list. */
export const LEGACY_PO_STATUSES = ["berjalan", "selesai"] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(v: unknown): v is string {
  return typeof v === "string" && EMAIL_RE.test(v);
}

export function isUserRole(v: unknown): v is UserRole {
  return typeof v === "string" && (USER_ROLES as readonly string[]).includes(v);
}

export function isOperatorStatus(v: unknown): v is OperatorStatus {
  return typeof v === "string" && (OPERATOR_STATUSES as readonly string[]).includes(v);
}

export function isPOStatus(v: unknown): v is POStatus {
  return typeof v === "string" && (PO_STATUSES as readonly string[]).includes(v);
}

/** Generates nomor_po like "PO-20260804-0001" and a matching scannable barcode string. */
export function generatePoIdentifiers(sequence: number) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  const nomor_po = `PO-${y}${m}${d}-${seq}`;
  const barcode_po = `GDR-PO-${y}${m}${d}${seq}`;
  return { nomor_po, barcode_po };
}

/** Generates a unique, scannable Code128 barcode string for an operator, e.g. "GDR-OP-0001". */
export function generateOperatorBarcode(sequence: number) {
  const seq = String(sequence).padStart(4, "0");
  return `GDR-OP-${seq}`;
}

export const ORDER_STATUSES = ["baru", "diproses", "selesai", "dibatalkan"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}

/** Suggested options for the "Metode Pembayaran" field on manual order input
 * (tombol "Input Order" di /order). Disimpan sebagai teks bebas, jadi ini
 * hanya dipakai untuk dropdown di UI — bukan enum yang divalidasi ketat. */
export const METODE_PEMBAYARAN_OPTIONS = ["Tunai", "Transfer Bank", "QRIS", "E-Wallet", "Lainnya"] as const;

/** Generates nomor_order like "ORD-20260814-0001", used for both the order
 * record and as the invoice number when printed. */
export function generateOrderNumber(sequence: number) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `ORD-${y}${m}${d}-${seq}`;
}
