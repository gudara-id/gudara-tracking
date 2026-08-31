-- Migrasi TAMBAHAN untuk fitur QC / catatan cacat di setoran jahit.
-- PENTING: file ini hanya boleh dijalankan SATU KALI. Kalau dijalankan dua
-- kali, statement ALTER TABLE akan gagal karena kolomnya sudah ada
-- (SQLite/D1 tidak mendukung "ADD COLUMN IF NOT EXISTS"). Kalau ternyata
-- sudah pernah dijalankan sebelumnya dan kamu run ulang lalu muncul error
-- "duplicate column name", itu tandanya migrasi ini SUDAH berhasil — aman
-- diabaikan.
--
-- Jalankan dengan:
--   npx wrangler d1 execute gudara-db --remote --file=./migration_add_reject_qc.sql

ALTER TABLE "setoran_jahit" ADD COLUMN "qty_reject" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "setoran_jahit" ADD COLUMN "catatan_reject" TEXT;
