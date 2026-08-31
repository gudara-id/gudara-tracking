-- Migrasi TAMBAHAN untuk fitur foto hasil jahit per setoran (dokumentasi
-- kualitas, bisa ditelusuri balik ke operator & tanggal setoran kalau ada
-- klaim cacat dari customer).
-- PENTING: file ini hanya boleh dijalankan SATU KALI. Kalau dijalankan dua
-- kali, ALTER TABLE akan gagal karena kolomnya sudah ada (SQLite/D1 tidak
-- mendukung "ADD COLUMN IF NOT EXISTS"). Kalau setelah run ulang muncul
-- error "duplicate column name", berarti migrasi ini SUDAH berhasil —
-- aman diabaikan.
--
-- Jalankan dengan:
--   npx wrangler d1 execute gudara-db --remote --file=./migration_add_setoran_foto.sql

ALTER TABLE "setoran_jahit" ADD COLUMN "foto_url" TEXT;
