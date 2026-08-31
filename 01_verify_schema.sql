-- Jalankan setelah 00_fix_missing_migrations.sql untuk memverifikasi
-- semua tabel & kolom penting sudah ada:
--   npx wrangler d1 execute gudara-db --remote --file=./01_verify_schema.sql
--
-- Cara baca hasil: setiap PRAGMA table_info menampilkan daftar kolom
-- tabel tersebut. Cocokkan dengan daftar kolom yang disebut di komentar
-- masing-masing — kalau kolom yang disebut TIDAK muncul di hasil,
-- berarti migrasinya belum berhasil untuk tabel itu.

-- artikels harus punya: id, kode_artikel, nama_artikel, harga_satuan, harga_jual, status, createdAt
PRAGMA table_info(artikels);

-- orders harus punya: ..., dp_amount, deadline, cancel_reason, cancelled_by, cancelled_at, metode_pembayaran, nama_po, po_id
PRAGMA table_info(orders);

-- setoran_jahit harus punya: ..., qty_reject, catatan_reject, foto_url
PRAGMA table_info(setoran_jahit);

-- tabel-tabel ini harus ADA (kalau error "no such table", berarti belum dibuat)
SELECT name FROM sqlite_master WHERE type='table' AND name IN
  ('add_ons', 'purchase_order_addons', 'payroll_periods', 'payroll_adjustments',
   'production_stages', 'po_members', 'po_checklist_items', 'password_reset_tokens',
   'activity_logs', 'app_settings', 'orders', 'order_items', 'sku_products');
