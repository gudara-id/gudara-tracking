-- Migrasi TAMBAHAN untuk foto produk di katalog SKU (dipakai untuk tampilan
-- ala marketplace di /order-form). Foto disimpan sebagai data URL base64,
-- sama seperti pola setoran_jahit.foto_url.
-- PENTING: file ini hanya boleh dijalankan SATU KALI. Kalau dijalankan dua
-- kali, ALTER TABLE akan gagal karena kolomnya sudah ada (SQLite/D1 tidak
-- mendukung "ADD COLUMN IF NOT EXISTS"). Kalau setelah run ulang muncul
-- error "duplicate column name", berarti migrasi ini SUDAH berhasil —
-- aman diabaikan.
--
-- Jalankan dengan:
--   npx wrangler d1 execute gudara-db --remote --file=./migration_add_sku_product_foto.sql
-- (atau --local untuk database lokal sebelum deploy)

ALTER TABLE "sku_products" ADD COLUMN "foto_url" TEXT;
