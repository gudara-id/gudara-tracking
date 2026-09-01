-- Migrasi TAMBAHAN untuk database D1 production yang sudah berjalan.
-- Menambahkan fitur Input Cutting: alurnya sama persis dengan Setoran Jahit
-- (scan operator -> scan PO -> isi QTY), disimpan di tabel terpisah
-- "setoran_cutting" supaya QTY yang dipotong bisa dibandingkan langsung
-- dengan QTY yang sudah dijahit untuk PO yang sama (lihat perbandingan di
-- modal Input Setoran Jahit / Input Cutting dan di detail PO).
--
-- Aman dijalankan meski tabel lain sudah ada (pakai IF NOT EXISTS).
--
-- Jalankan dengan:
--   npx wrangler d1 execute gudara-db --remote --file=./migration_add_cutting.sql
-- (atau --local untuk database lokal simulasi Cloudflare, lihat DEPLOY_CLOUDFLARE.md)

CREATE TABLE IF NOT EXISTS "setoran_cutting" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tanggal_setoran" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operator_id" INTEGER NOT NULL,
  "po_id" INTEGER NOT NULL,
  "qty_disetor" INTEGER NOT NULL,
  "qty_reject" INTEGER NOT NULL DEFAULT 0,
  "catatan_reject" TEXT,
  "admin_cutting_id" INTEGER NOT NULL,
  "foto_url" TEXT,
  CONSTRAINT "setoran_cutting_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "setoran_cutting_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "setoran_cutting_admin_cutting_id_fkey" FOREIGN KEY ("admin_cutting_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "setoran_cutting_tanggal_setoran_idx" ON "setoran_cutting"("tanggal_setoran");
CREATE INDEX IF NOT EXISTS "setoran_cutting_operator_id_idx" ON "setoran_cutting"("operator_id");
CREATE INDEX IF NOT EXISTS "setoran_cutting_po_id_idx" ON "setoran_cutting"("po_id");

-- Akun demo untuk role baru "admin_cutting" (password sama seperti demo lain: gudara123).
-- Hash di bawah ini identik dengan yang dipakai untuk akun 'jahit' di prisma/seed.sql.
INSERT OR IGNORE INTO "users" ("username", "password_hash", "role", "nama_lengkap") VALUES
  ('cutting', '$2a$10$WHRtxohKYCc6trHjgMAj2uPpjzTEfr4lSjSLmuHN0XFrRKgAHciCW', 'admin_cutting', 'Admin Cutting');
