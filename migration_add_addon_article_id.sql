-- Migrasi TAMBAHAN (jalankan SETELAH migration_add_addons.sql).
-- Menambahkan kolom po_article_id ke purchase_order_addons, supaya add-on
-- bisa terikat ke SATU baris artikel tertentu dalam PO (bukan ke seluruh
-- PO), karena tiap artikel dalam satu PO bisa berbeda add-on-nya.
--
-- Kalau kolom sudah pernah ditambahkan sebelumnya, perintah ALTER TABLE di
-- bawah akan gagal dengan pesan "duplicate column name" — itu NORMAL,
-- artinya migrasi ini sudah pernah dijalankan, aman diabaikan.
--
-- Jalankan dengan:
--   npx wrangler d1 execute gudara-db --remote --file=./migration_add_addon_article_id.sql

ALTER TABLE "purchase_order_addons" ADD COLUMN "po_article_id" INTEGER REFERENCES "purchase_order_articles"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "purchase_order_addons_po_article_id_idx" ON "purchase_order_addons"("po_article_id");
