-- Migrasi TAMBAHAN untuk fitur "Input Order" manual (admin/sales input
-- order langsung dari dashboard, bukan lewat form pemesanan publik) yang
-- lalu masuk sebagai permintaan input PO ke produksi dan divalidasi oleh
-- admin_produksi.
--
-- PENTING: file ini hanya boleh dijalankan SATU KALI. Kalau dijalankan dua
-- kali, statement ALTER TABLE akan gagal karena kolomnya sudah ada
-- (SQLite/D1 tidak mendukung "ADD COLUMN IF NOT EXISTS"). Kalau ternyata
-- sudah pernah dijalankan sebelumnya dan kamu run ulang lalu muncul error
-- "duplicate column name", itu tandanya migrasi ini SUDAH berhasil — aman
-- diabaikan.
--
-- Jalankan dengan:
--   npx wrangler d1 execute gudara-db --local  --file=./migration_add_order_manual_input.sql
--   npx wrangler d1 execute gudara-db --remote --file=./migration_add_order_manual_input.sql

ALTER TABLE "orders" ADD COLUMN "metode_pembayaran" TEXT;
ALTER TABLE "orders" ADD COLUMN "nama_po" TEXT;
ALTER TABLE "orders" ADD COLUMN "po_id" INTEGER REFERENCES "purchase_orders"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "orders_po_id_idx" ON "orders"("po_id");
