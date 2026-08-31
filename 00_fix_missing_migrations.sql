-- =====================================================================
-- GUDARA Tracking — Gabungan migrasi yang BELUM pernah dijalankan ke D1
-- production, ditemukan lewat audit source code sebelum go-live.
--
-- Aman dijalankan meski beberapa bagian sudah pernah diterapkan
-- sebagian, KECUALI baris ALTER TABLE: kalau sudah pernah jalan dan
-- Anda run ulang, ALTER TABLE akan gagal dengan pesan
-- "duplicate column name" — itu NORMAL dan aman diabaikan, artinya
-- kolom itu memang sudah ada.
--
-- Jalankan dari folder project di komputer Anda:
--   npx wrangler d1 execute gudara-db --remote --file=./00_fix_missing_migrations.sql
-- =====================================================================

-- 1) Artikel: kolom harga_jual (fitur "Harga Jual" di Database Artikel)
ALTER TABLE "artikels" ADD COLUMN "harga_jual" DECIMAL DEFAULT 0;

-- 2) Add-On / Aksesoris (Konfigurasi > Database Artikel)
CREATE TABLE IF NOT EXISTS "add_ons" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nama" TEXT NOT NULL,
  "harga" DECIMAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'aktif',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "add_ons_nama_key" ON "add_ons"("nama");

CREATE TABLE IF NOT EXISTS "purchase_order_addons" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "po_id" INTEGER NOT NULL,
  "po_article_id" INTEGER,
  "addon_id" INTEGER,
  "nama_addon" TEXT NOT NULL,
  "harga_addon" DECIMAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_order_addons_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_addons_po_article_id_fkey" FOREIGN KEY ("po_article_id") REFERENCES "purchase_order_articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "add_ons" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "purchase_order_addons_po_id_idx" ON "purchase_order_addons"("po_id");
CREATE INDEX IF NOT EXISTS "purchase_order_addons_po_article_id_idx" ON "purchase_order_addons"("po_article_id");

-- 3) Payroll (menu Payroll)
CREATE TABLE IF NOT EXISTS "payroll_periods" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "label" TEXT NOT NULL,
  "start_date" DATETIME NOT NULL,
  "end_date" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "created_by" INTEGER NOT NULL,
  "paid_by" INTEGER,
  "paid_at" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_periods_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "payroll_periods_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "users" ("id")
);
CREATE INDEX IF NOT EXISTS "payroll_periods_start_date_idx" ON "payroll_periods"("start_date");

CREATE TABLE IF NOT EXISTS "payroll_adjustments" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "period_id" INTEGER NOT NULL,
  "operator_id" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  "created_by" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_adjustments_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods" ("id") ON DELETE CASCADE,
  CONSTRAINT "payroll_adjustments_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators" ("id"),
  CONSTRAINT "payroll_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id")
);
CREATE INDEX IF NOT EXISTS "payroll_adjustments_period_id_idx" ON "payroll_adjustments"("period_id");
CREATE INDEX IF NOT EXISTS "payroll_adjustments_operator_id_idx" ON "payroll_adjustments"("operator_id");

-- 4) Setoran Jahit: kolom QC reject
ALTER TABLE "setoran_jahit" ADD COLUMN "qty_reject" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "setoran_jahit" ADD COLUMN "catatan_reject" TEXT;

-- 5) Orders: input manual PO (metode_pembayaran, nama_po, po_id)
ALTER TABLE "orders" ADD COLUMN "metode_pembayaran" TEXT;
ALTER TABLE "orders" ADD COLUMN "nama_po" TEXT;
ALTER TABLE "orders" ADD COLUMN "po_id" INTEGER REFERENCES "purchase_orders"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "orders_po_id_idx" ON "orders"("po_id");

-- 6) Orders: DP / deadline / cancel-order (KRITIS — dipakai di setiap
--    INSERT order baru, termasuk dari /order-form publik. Tanpa ini,
--    customer tidak akan bisa submit order sama sekali.)
ALTER TABLE "orders" ADD COLUMN "dp_amount" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "deadline" DATETIME;
ALTER TABLE "orders" ADD COLUMN "cancel_reason" TEXT;
ALTER TABLE "orders" ADD COLUMN "cancelled_by" INTEGER;
ALTER TABLE "orders" ADD COLUMN "cancelled_at" DATETIME;
CREATE INDEX IF NOT EXISTS "orders_deadline_idx" ON "orders"("deadline");

-- Selesai. Setelah ini jalankan verifikasi di 01_verify_schema.sql
-- untuk memastikan semua kolom/tabel di atas sudah benar-benar ada.
