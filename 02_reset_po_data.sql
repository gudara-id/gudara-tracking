-- Reset data PO & produksi untuk mulai bersih hari ini.
--
-- YANG DIHAPUS:
--   - Semua Purchase Order (purchase_orders)
--   - Otomatis ikut terhapus (ON DELETE CASCADE): artikel per-PO,
--     add-on per-PO, lampiran/attachment PO, anggota PO (po_members),
--     checklist PO
--   - Semua Setoran Jahit (setoran_jahit) — riwayat input hasil jahit
--     per PO
--
-- YANG TIDAK DIHAPUS (tetap aman):
--   - Database Artikel, Operator, User, SKU Produk, Add-On master,
--     Tahapan Produksi, Pengaturan (Konfigurasi)
--   - Customer Order dari /order-form (tabel "orders") — hanya
--     kolom po_id-nya yang otomatis jadi kosong (SET NULL) karena
--     PO yang ditunjuknya sudah dihapus. Kalau Anda mau reset data
--     Order juga, beri tahu saya dulu sebelum jalankan skrip terpisah,
--     karena itu data pesanan customer yang mungkin masih perlu dilacak.
--   - Payroll (payroll_periods / payroll_adjustments) — periode payroll
--     lama akan tetap ada tapi upah dari setoran yang dihapus otomatis
--     hilang dari perhitungannya. Beri tahu saya kalau payroll juga
--     mau di-reset.
--
-- Jalankan dari folder project di komputer Anda:
--   npx wrangler d1 execute gudara-db --remote --file=./02_reset_po_data.sql

-- Urutan penting: hapus setoran_jahit dulu (tidak ber-cascade ke po),
-- baru purchase_orders (yang akan men-cascade ke tabel anak lainnya).
DELETE FROM "setoran_jahit";
DELETE FROM "purchase_orders";

-- Reset counter auto-increment supaya ID mulai dari 1 lagi (opsional,
-- tapi rapi untuk mulai fresh). Aman dihapus baris ini kalau Anda tidak
-- masalah dengan ID yang lompat.
DELETE FROM "sqlite_sequence" WHERE name IN
  ('setoran_jahit', 'purchase_orders', 'purchase_order_articles',
   'purchase_order_addons', 'purchase_order_attachments',
   'po_members', 'po_checklist_items');
