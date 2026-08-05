// Lightweight validators for fields that are DB-typed as String
// (SQLite has no native enum support in Prisma) but are logically
// fixed unions. Kept dependency-free; swap for Zod if you prefer.

export const USER_ROLES = ["admin_produksi", "admin_jahit", "operator_jahit"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const OPERATOR_STATUSES = ["aktif", "non-aktif"] as const;
export type OperatorStatus = (typeof OPERATOR_STATUSES)[number];

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

export const PO_STATUSES = ["berjalan", "selesai", ...KANBAN_PO_STATUSES] as const;
export type POStatus = (typeof PO_STATUSES)[number];

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
