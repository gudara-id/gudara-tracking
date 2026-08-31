-- Migrasi TAMBAHAN untuk database D1 production yang sudah berjalan.
-- Menambahkan fitur Add-On / Aksesoris pada Database Artikel: katalog
-- add-on global (misal: bordir, aksesoris) yang bisa dicentang saat bikin
-- PO. Total harga add-on yang dipilih ditambahkan ke harga dasar artikel
-- untuk membentuk harga_satuan PO, yang otomatis juga menaikkan upah
-- operator jahit (karena setoran_jahit menyimpan snapshot harga_satuan PO).
--
-- Aman dijalankan meski tabel lain sudah ada (pakai IF NOT EXISTS).
--
-- Jalankan dengan:
--   npx wrangler d1 execute gudara-db --remote --file=./migration_add_addons.sql

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
