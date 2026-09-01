-- GUDARA Production & Sewing Tracker
-- D1 (SQLite) schema migration, hand-generated to match prisma/schema.prisma
-- Apply with: wrangler d1 execute gudara-db --remote --file=./prisma/migration.sql

CREATE TABLE "users" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "username" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "nama_lengkap" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

CREATE TABLE "artikels" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "kode_artikel" TEXT,
  "nama_artikel" TEXT NOT NULL,
  "harga_satuan" DECIMAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'aktif',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "artikels_kode_artikel_key" ON "artikels"("kode_artikel");
CREATE UNIQUE INDEX "artikels_nama_artikel_key" ON "artikels"("nama_artikel");

CREATE TABLE IF NOT EXISTS "sku_products" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "sku" TEXT NOT NULL,
  "nama_produk" TEXT NOT NULL,
  "harga_satuan" DECIMAL NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'aktif',
  "foto_url" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "sku_products_sku_key" ON "sku_products"("sku");
CREATE INDEX IF NOT EXISTS "sku_products_status_idx" ON "sku_products"("status");

CREATE TABLE "operators" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "barcode_operator" TEXT NOT NULL,
  "nama_operator" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'aktif',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "operators_barcode_operator_key" ON "operators"("barcode_operator");

CREATE TABLE "purchase_orders" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nomor_po" TEXT NOT NULL,
  "barcode_po" TEXT NOT NULL,
  "nama_po" TEXT NOT NULL,
  "nama_artikel" TEXT NOT NULL,
  "harga_satuan" DECIMAL NOT NULL,
  "target_qty" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'berjalan',
  "label" TEXT,
  "due_date" DATETIME,
  "description" TEXT,
  "created_by" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id")
);
CREATE UNIQUE INDEX "purchase_orders_nomor_po_key" ON "purchase_orders"("nomor_po");
CREATE UNIQUE INDEX "purchase_orders_barcode_po_key" ON "purchase_orders"("barcode_po");

CREATE TABLE "purchase_order_articles" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "po_id" INTEGER NOT NULL,
  "artikel_id" INTEGER,
  "nama_artikel" TEXT NOT NULL,
  "harga_satuan" DECIMAL NOT NULL,
  "qty" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_order_articles_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE,
  CONSTRAINT "purchase_order_articles_artikel_id_fkey" FOREIGN KEY ("artikel_id") REFERENCES "artikels" ("id") ON DELETE SET NULL
);
CREATE INDEX "purchase_order_articles_po_id_idx" ON "purchase_order_articles"("po_id");
CREATE INDEX "purchase_order_articles_artikel_id_idx" ON "purchase_order_articles"("artikel_id");

CREATE TABLE "purchase_order_attachments" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "po_id" INTEGER NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "is_cover" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_order_attachments_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE
);
CREATE INDEX "purchase_order_attachments_po_id_idx" ON "purchase_order_attachments"("po_id");

CREATE TABLE "setoran_jahit" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tanggal_setoran" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operator_id" INTEGER NOT NULL,
  "po_id" INTEGER NOT NULL,
  "qty_disetor" INTEGER NOT NULL,
  "harga_satuan_snapshot" DECIMAL NOT NULL,
  "total_upah" DECIMAL NOT NULL,
  "admin_jahit_id" INTEGER NOT NULL,
  CONSTRAINT "setoran_jahit_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators" ("id"),
  CONSTRAINT "setoran_jahit_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id"),
  CONSTRAINT "setoran_jahit_admin_jahit_id_fkey" FOREIGN KEY ("admin_jahit_id") REFERENCES "users" ("id")
);
CREATE INDEX "setoran_jahit_tanggal_setoran_idx" ON "setoran_jahit"("tanggal_setoran");
CREATE INDEX "setoran_jahit_operator_id_idx" ON "setoran_jahit"("operator_id");
CREATE INDEX "setoran_jahit_po_id_idx" ON "setoran_jahit"("po_id");

-- Added 2026-08-05: email & avatar_url for user profile feature
ALTER TABLE "users" ADD COLUMN "email" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Added 2026-08-05: password reset and audit log feature
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

CREATE TABLE IF NOT EXISTS "activity_logs" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER,
  "entity" TEXT NOT NULL,
  "entity_id" INTEGER,
  "action" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "activity_logs_entity_entity_id_idx" ON "activity_logs"("entity", "entity_id");
CREATE INDEX IF NOT EXISTS "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- Added 2026-08-05: editable application settings for admin configuration.
CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "updatedAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "app_settings_key_key" ON "app_settings"("key");

INSERT OR IGNORE INTO "app_settings" ("key", "value", "label", "description", "updatedAt")
VALUES
  ('company_name', 'GUDARA', 'Nama Perusahaan', 'Nama yang tampil pada dokumen cetak dan label internal.', CURRENT_TIMESTAMP),
  ('due_soon_days', '2', 'Batas PO Mendekati Due Date', 'Jumlah hari sebelum due date agar PO diberi badge/peringatan.', CURRENT_TIMESTAMP),
  ('work_week_label', 'Sen-Sab', 'Label Minggu Kerja', 'Label periode kerja untuk laporan setoran jahit.', CURRENT_TIMESTAMP),
  ('payroll_note', 'Rekap upah berdasarkan setoran jahit yang sudah diinput admin.', 'Catatan Slip Upah', 'Catatan standar yang dipakai admin saat mencetak slip/rekap upah.', CURRENT_TIMESTAMP),
  ('reset_email_webhook_hint', '', 'Webhook Email Reset Password', 'Catatan URL webhook email. Nilai operasional tetap disarankan disimpan di env RESET_EMAIL_WEBHOOK_URL.', CURRENT_TIMESTAMP);

-- Added 2026-08-08: configurable production stages (Konfigurasi > Tahapan
-- Produksi) replacing the hardcoded KANBAN_PO_STATUSES list, plus per-PO
-- members and checklist items for the production board card actions.
CREATE TABLE IF NOT EXISTS "production_stages" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nama" TEXT NOT NULL,
  "urutan" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "production_stages_nama_key" ON "production_stages"("nama");
CREATE INDEX IF NOT EXISTS "production_stages_urutan_idx" ON "production_stages"("urutan");

INSERT OR IGNORE INTO "production_stages" ("nama", "urutan") VALUES
  ('PRINT PO TINGKING', 1),
  ('ANTRIAN PRINT RAJA PRINTING', 2),
  ('ANTRIAN PRESS', 3),
  ('SELESAI PRESS', 4),
  ('PO EMBOSS', 5),
  ('PROSES CUTTING', 6),
  ('SIAP JAHIT', 7),
  ('JAHIT', 8),
  ('FINISHING / PACKING', 9),
  ('SIAP KIRIM', 10),
  ('TERKIRIM', 11);

CREATE TABLE IF NOT EXISTS "po_members" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "po_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "po_members_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "po_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "po_members_po_id_user_id_key" ON "po_members"("po_id", "user_id");
CREATE INDEX IF NOT EXISTS "po_members_po_id_idx" ON "po_members"("po_id");

CREATE TABLE IF NOT EXISTS "po_checklist_items" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "po_id" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "is_done" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "po_checklist_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "po_checklist_items_po_id_idx" ON "po_checklist_items"("po_id");

ALTER TABLE "setoran_jahit" ADD COLUMN "foto_url" TEXT;

-- Added: Input Cutting — same flow as Setoran Jahit (scan operator -> scan
-- PO -> QTY), stored separately so cutting QTY can be compared against
-- jahit QTY for the same PO. See migration_add_cutting.sql for the
-- standalone incremental version run against already-deployed D1 DBs.
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

-- Added 2026-08-14: Order section — public order form (shareable link, no
-- login) + invoice, for customers to submit orders directly instead of
-- manually via chat/WA. See prisma/migrations/20260814180000_add_orders.
CREATE TABLE IF NOT EXISTS "orders" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nomor_order" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'baru',
  "buyer_nama" TEXT NOT NULL,
  "buyer_telepon" TEXT,
  "buyer_alamat" TEXT,
  "catatan" TEXT,
  "subtotal" DECIMAL NOT NULL DEFAULT 0,
  "confirmed_by" INTEGER,
  "confirmed_at" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users" ("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_nomor_order_key" ON "orders"("nomor_order");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "orders_createdAt_idx" ON "orders"("createdAt");

CREATE TABLE IF NOT EXISTS "order_items" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "order_id" INTEGER NOT NULL,
  "artikel_id" INTEGER,
  "sku_produk_id" INTEGER,
  "sku_produk_sku" TEXT,
  "nama_artikel" TEXT NOT NULL,
  "harga_satuan" DECIMAL NOT NULL,
  "qty" INTEGER NOT NULL,
  "subtotal" DECIMAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE,
  CONSTRAINT "order_items_artikel_id_fkey" FOREIGN KEY ("artikel_id") REFERENCES "artikels" ("id") ON DELETE SET NULL,
  CONSTRAINT "order_items_sku_produk_id_fkey" FOREIGN KEY ("sku_produk_id") REFERENCES "sku_products" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX IF NOT EXISTS "order_items_artikel_id_idx" ON "order_items"("artikel_id");
CREATE INDEX IF NOT EXISTS "order_items_sku_produk_id_idx" ON "order_items"("sku_produk_id");

INSERT OR IGNORE INTO "app_settings" ("key", "value", "label", "description", "updatedAt")
VALUES
  ('invoice_note', 'Terima kasih atas pesanan Anda.', 'Catatan Invoice', 'Catatan standar yang tampil di bagian bawah invoice pesanan.', CURRENT_TIMESTAMP);

-- Added 2026-08-14: SKU product seed from SKU_Gudang20260814154508557.xlsx.
-- Prices default to 0 and should be configured before products appear in the public order form.
INSERT OR IGNORE INTO "sku_products" ("sku", "nama_produk", "harga_satuan", "status") VALUES
  ('WST-2XL', 'Gudara - Waffle Stripe Tee Kaos Olahraga Pria Dry Fit Stripe Tape Shoulder / Baju Futsal Badminton Gym', 0, 'aktif'),
  ('WST-XL', 'Gudara - Waffle Stripe Tee Kaos Olahraga Pria Dry Fit Stripe Tape Shoulder / Baju Futsal Badminton Gym', 0, 'aktif'),
  ('WST-L', 'Gudara - Waffle Stripe Tee Kaos Olahraga Pria Dry Fit Stripe Tape Shoulder / Baju Futsal Badminton Gym', 0, 'aktif'),
  ('WST-M', 'Gudara - Waffle Stripe Tee Kaos Olahraga Pria Dry Fit Stripe Tape Shoulder / Baju Futsal Badminton Gym', 0, 'aktif'),
  ('WSTB-S', 'Gudara - Waffle Stripe Tee Kaos Olahraga Pria Dry Fit Stripe Tape Shoulder / Baju Futsal Badminton Gym Sport Jersey', 0, 'aktif'),
  ('WSTB-M', 'Gudara - Waffle Stripe Tee Kaos Olahraga Pria Dry Fit Stripe Tape Shoulder / Baju Futsal Badminton Gym Sport Jersey', 0, 'aktif'),
  ('WSTB-L', 'Gudara - Waffle Stripe Tee Kaos Olahraga Pria Dry Fit Stripe Tape Shoulder / Baju Futsal Badminton Gym Sport Jersey', 0, 'aktif'),
  ('WSTB-XL', 'Gudara - Waffle Stripe Tee Kaos Olahraga Pria Dry Fit Stripe Tape Shoulder / Baju Futsal Badminton Gym Sport Jersey', 0, 'aktif'),
  ('WSTB-2XL', 'Gudara - Waffle Stripe Tee Kaos Olahraga Pria Dry Fit Stripe Tape Shoulder / Baju Futsal Badminton Gym Sport Jersey', 0, 'aktif'),
  ('EV-PENDEK-WANGKI-MERAH-S', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('ENGS', 'GUDARA Jersey Bola Dewasa Fantasy Full Printing Sublime Sport Dry-fit Zipper di Dada', 0, 'aktif'),
  ('JK-HITAM-S', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-HITAM-M', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-HITAM-L', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-HITAM-XL', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-HITAM-2XL', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-PUTIH-S', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-PUTIH-M', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-PUTIH-L', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-PUTIH-XL', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-PUTIH-2XL', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-MERAH-S', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-MERAH-M', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-MERAH-L', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-MERAH-XL', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('JK-MERAH-2XL', 'Jersey Oversize Pria Kemerdekaan 17 Agustus HUT RI 80 | Baju Olahraga Merah Putih Hitam Gudara Kaos Atasan', 0, 'aktif'),
  ('GRMS', 'GUDARA Jersey Bola Dewasa Fantasy Full Printing Sublime Sport Dry-fit Zipper di Dada', 0, 'aktif'),
  ('GRMM', 'GUDARA Jersey Bola Dewasa Fantasy Full Printing Sublime Sport Dry-fit Zipper di Dada', 0, 'aktif'),
  ('GRML', 'GUDARA Jersey Bola Dewasa Fantasy Full Printing Sublime Sport Dry-fit Zipper di Dada', 0, 'aktif'),
  ('GRMXL', 'GUDARA Jersey Bola Dewasa Fantasy Full Printing Sublime Sport Dry-fit Zipper di Dada', 0, 'aktif'),
  ('GRM2XL', 'GUDARA Jersey Bola Dewasa Fantasy Full Printing Sublime Sport Dry-fit Zipper di Dada', 0, 'aktif'),
  ('ENGM', 'GUDARA Jersey Bola Dewasa Fantasy Full Printing Sublime Sport Dry-fit Zipper di Dada', 0, 'aktif'),
  ('ENGL', 'GUDARA Jersey Bola Dewasa Fantasy Full Printing Sublime Sport Dry-fit Zipper di Dada', 0, 'aktif'),
  ('ENGXL', 'GUDARA Jersey Bola Dewasa Fantasy Full Printing Sublime Sport Dry-fit Zipper di Dada', 0, 'aktif'),
  ('ENG2XL', 'GUDARA Jersey Bola Dewasa Fantasy Full Printing Sublime Sport Dry-fit Zipper di Dada', 0, 'aktif'),
  ('EV-PENDEK-VNECK-TURKISH-XS', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-TURSKISH-2XL', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TURSKISH-2XL', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-TURSKISH-XL', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TURKISH-XL', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-TURSKISH-M', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TURKISH-L', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-TURSKISH-L', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TURKISH-M', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-TURSKISH-S', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TURKISH-S', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TURKISH-XS', 'Gudara - Kaos Olahraga Bahan Dryfit Embos Variasi Polos Elegan dan Sporty Vol.2', 0, 'aktif'),
  ('WST-S', 'Gudara - Waffle Stripe Tee Kaos Olahraga Pria Dry Fit Stripe Tape Shoulder / Baju Futsal Badminton Gym', 0, 'aktif'),
  ('TEAL-BLAZE-S', 'Gudara - Running Aurora Mist Teal Blaze Baju Olahraga Lari Pria Dry Fit Quick Dry Lengan Pendek', 0, 'aktif'),
  ('TEAL-BLAZE-M', 'Gudara - Running Aurora Mist Teal Blaze Baju Olahraga Lari Pria Dry Fit Quick Dry Lengan Pendek', 0, 'aktif'),
  ('TEAL-BLAZE-L', 'Gudara - Running Aurora Mist Teal Blaze Baju Olahraga Lari Pria Dry Fit Quick Dry Lengan Pendek', 0, 'aktif'),
  ('BLAZE-S', 'Gudara - Running Blaze Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('BLAZE-M', 'Gudara - Running Blaze Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('BLAZE-L', 'Gudara - Running Blaze Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('TERRAIN-BLACK-S', 'Gudara - Running Terrain Black Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('TERRAIN-BLACK-M', 'Gudara - Running Terrain Black Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('TERRAIN-BLACK-L', 'Gudara - Running Terrain Black Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('TERRAIN-TOSCA-S', 'Gudara - Running Terrain Tosca Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('TERRAIN-TOSCA-M', 'Gudara - Running Terrain Tosca Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('TERRAIN-TOSCA-L', 'Gudara - Running Terrain Tosca Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('VORTEX-GREEN-S', 'Gudara - Running Vortex Activewear Green Blue Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('VORTEX-GREEN-M', 'Gudara - Running Vortex Activewear Green Blue Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('VORTEX-GREEN-L', 'Gudara - Running Vortex Activewear Green Blue Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('VORTEX-BLUE-S', 'Gudara - Running Vortex Activewear Navy Blue Kaos Olahraga Bahan Dry fit anti UV', 0, 'aktif'),
  ('VORTEX-BLUE-M', 'Gudara - Running Vortex Activewear Navy Blue Kaos Olahraga Bahan Dry fit anti UV', 0, 'aktif'),
  ('VORTEX-BLUE-L', 'Gudara - Running Vortex Activewear Navy Blue Kaos Olahraga Bahan Dry fit anti UV', 0, 'aktif'),
  ('ARMY-HITAM-S', 'Gudara - Running Army Hitam Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('ARMY-HITAM-M', 'Gudara - Running Army Hitam Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('ARMY-HITAM-L', 'Gudara - Running Army Hitam Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('ARMY-MUDA-S', 'Gudara - Running Army Muda Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('ARMY-MUDA-M', 'Gudara - Running Army Muda Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('ARMY-MUDA-L', 'Gudara - Running Army Muda Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('TEAL-SOLAR-S', 'Gudara - Running Aurora Mist Solar Fade Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('TEAL-SOLAR-M', 'Gudara - Running Aurora Mist Solar Fade Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('TEAL-SOLAR-L', 'Gudara - Running Aurora Mist Solar Fade Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('NATURE-S', 'Gudara - Running Nature Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('NATURE-M', 'Gudara - Running Nature Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('NATURE-L', 'Gudara - Running Nature Kaos Olahraga Bahan Dry fit anti UV Lengan Pendek', 0, 'aktif'),
  ('RETRO-HITAM-M', 'Gudara - Jersey Retro Vintage Oversize Casual Lengan Pendek Unisex Bahan Dryfit', 0, 'aktif'),
  ('RETRO-HITAM-L', 'Gudara - Jersey Retro Vintage Oversize Casual Lengan Pendek Unisex Bahan Dryfit', 0, 'aktif'),
  ('RETRO-HITAM-XL', 'Gudara - Jersey Retro Vintage Oversize Casual Lengan Pendek Unisex Bahan Dryfit', 0, 'aktif'),
  ('RETRO-MERAH-M', 'Gudara - Jersey Retro Vintage Oversize Casual Lengan Pendek Unisex Bahan Dryfit', 0, 'aktif'),
  ('RETRO-MERAH-L', 'Gudara - Jersey Retro Vintage Oversize Casual Lengan Pendek Unisex Bahan Dryfit', 0, 'aktif'),
  ('RETRO-MERAH-XL', 'Gudara - Jersey Retro Vintage Oversize Casual Lengan Pendek Unisex Bahan Dryfit', 0, 'aktif'),
  ('KARATE-HITAM-M', 'Gudara - Jersey Karate Oversize Hitam Dry fit Premium', 0, 'aktif'),
  ('KARATE-HITAM-L', 'Gudara - Jersey Karate Oversize Hitam Dry fit Premium', 0, 'aktif'),
  ('TAEKWONDO-PUTIH-M', 'Gudara - Jersey Taekwondo Oversize Putih Dry Fit Premium untuk Aktivitas Taekwondo Anda dengan Kenyamanan Maksimal dan Desain Oversize', 0, 'aktif'),
  ('TAEKWONDO-PUTIH-L', 'Gudara - Jersey Taekwondo Oversize Putih Dry Fit Premium untuk Aktivitas Taekwondo Anda dengan Kenyamanan Maksimal dan Desain Oversize', 0, 'aktif'),
  ('TAEKWONDO-HITAM-M', 'Gudara - Jersey Taekwondo Oversize Hitam Dry fit Premium', 0, 'aktif'),
  ('TAEKWONDO-HITAM-L', 'Gudara - Jersey Taekwondo Oversize Hitam Dry fit Premium', 0, 'aktif'),
  ('ES-MERAH-XS', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-MAROON-XS', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-HITAM-XS', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-ABU-XS', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-NAVY-XS', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-MERAH-S', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-MAROON-S', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-HITAM-S', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-ABU-S', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-NAVY-S', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-BIRU-XS', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-BIRU-S', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-BIRU-M', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-BIRU-L', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-BIRU-XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-BIRU-2XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-MERAH-M', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-MAROON-M', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-HITAM-M', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-ABU-M', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-NAVY-M', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-MERAH-L', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-MAROON-L', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-HITAM-L', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-ABU-L', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-NAVY-L', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-MERAH-XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-MAROON-XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-HITAM-XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-ABU-XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-NAVY-XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-MERAH-2XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-MAROON-2XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-HITAM-2XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-ABU-2XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('ES-NAVY-2XL', 'Gudara - Jersey Embos Strip Polos -  Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('SINGLET-BIRU-M', 'Gudara - Kaos Olahraga Bahan Dry fit Embos anti UV Lengan Pendek Singlet Sleeveles', 0, 'aktif'),
  ('SINGLET-BIRU-L', 'Gudara - Kaos Olahraga Bahan Dry fit Embos anti UV Lengan Pendek Singlet Sleeveles', 0, 'aktif'),
  ('SINGLET-BIRU-XL', 'Gudara - Kaos Olahraga Bahan Dry fit Embos anti UV Lengan Pendek Singlet Sleeveles', 0, 'aktif'),
  ('SINGLET-MERAH-M', 'Gudara - Kaos Olahraga Bahan Dry fit Embos anti UV Lengan Pendek Singlet Sleeveles', 0, 'aktif'),
  ('SINGLET-MERAH-L', 'Gudara - Kaos Olahraga Bahan Dry fit Embos anti UV Lengan Pendek Singlet Sleeveles', 0, 'aktif'),
  ('SINGLET-MERAH-XL', 'Gudara - Kaos Olahraga Bahan Dry fit Embos anti UV Lengan Pendek Singlet Sleeveles', 0, 'aktif'),
  ('EKR-PUTIH-M', 'Gudara - Jersey Embos Variasi Kerah Lengan Pendek Sport Elegant', 0, 'aktif'),
  ('EKR-PUTIH-L', 'Gudara - Jersey Embos Variasi Kerah Lengan Pendek Sport Elegant', 0, 'aktif'),
  ('EKR-PUTIH-XL', 'Gudara - Jersey Embos Variasi Kerah Lengan Pendek Sport Elegant', 0, 'aktif'),
  ('EKR-NAVY-M', 'Gudara - Jersey Embos Variasi Kerah Lengan Pendek Sport Elegant', 0, 'aktif'),
  ('EKR-NAVY-L', 'Gudara - Jersey Embos Variasi Kerah Lengan Pendek Sport Elegant', 0, 'aktif'),
  ('EKR-NAVY-XL', 'Gudara - Jersey Embos Variasi Kerah Lengan Pendek Sport Elegant', 0, 'aktif'),
  ('REFIND-POWER-S', 'Gudara - Kaos Oversized Rugby Jersey Refind Power Lengan Pendek Couple Unisex', 0, 'aktif'),
  ('REFIND-POWER-M', 'Gudara - Kaos Oversized Rugby Jersey Refind Power Lengan Pendek Couple Unisex', 0, 'aktif'),
  ('REFIND-POWER-L', 'Gudara - Kaos Oversized Rugby Jersey Refind Power Lengan Pendek Couple Unisex', 0, 'aktif'),
  ('CLN-NEW-M', 'Gudara Celana Pendek Olahraga Authentic Dry Fit Milano Premium / Short Pants Sport Pria Running Gym', 0, 'aktif'),
  ('CLN-NEW-L', 'Gudara Celana Pendek Olahraga Authentic Dry Fit Milano Premium / Short Pants Sport Pria Running Gym', 0, 'aktif'),
  ('CLN-NEW-XL', 'Gudara Celana Pendek Olahraga Authentic Dry Fit Milano Premium / Short Pants Sport Pria Running Gym', 0, 'aktif'),
  ('CLN-NEW-2XL', 'Gudara Celana Pendek Olahraga Authentic Dry Fit Milano Premium / Short Pants Sport Pria Running Gym', 0, 'aktif'),
  ('CHAMPION-S', 'Gudara - Oversized Rugby Jersey Champions Lengan Pendek Unisex', 0, 'aktif'),
  ('CHAMPION-M', 'Gudara - Oversized Rugby Jersey Champions Lengan Pendek Unisex', 0, 'aktif'),
  ('CHAMPION-L', 'Gudara - Oversized Rugby Jersey Champions Lengan Pendek Unisex', 0, 'aktif'),
  ('EV-ANAK-HITAM-S', 'Gudara - Jersey Embos Variasi Setelan Anak Usia 4-12Tahun', 0, 'aktif'),
  ('EV-ANAK-HITAM-M', 'Gudara - Jersey Embos Variasi Setelan Anak Usia 4-12Tahun', 0, 'aktif'),
  ('EV-ANAK-HITAM-L', 'Gudara - Jersey Embos Variasi Setelan Anak Usia 4-12Tahun', 0, 'aktif'),
  ('EV-ANAK-HITAM-XL', 'Gudara - Jersey Embos Variasi Setelan Anak Usia 4-12Tahun', 0, 'aktif'),
  ('EV-ANAK-HITAM-2XL', 'Gudara - Jersey Embos Variasi Setelan Anak Usia 4-12Tahun', 0, 'aktif'),
  ('EV-ANAK-PUTIH-S', 'Gudara - Jersey Embos Variasi Setelan Anak Usia 4-12Tahun', 0, 'aktif'),
  ('EV-ANAK-PUTIH-M', 'Gudara - Jersey Embos Variasi Setelan Anak Usia 4-12Tahun', 0, 'aktif'),
  ('EV-ANAK-PUTIH-L', 'Gudara - Jersey Embos Variasi Setelan Anak Usia 4-12Tahun', 0, 'aktif'),
  ('EV-ANAK-PUTIH-XL', 'Gudara - Jersey Embos Variasi Setelan Anak Usia 4-12Tahun', 0, 'aktif'),
  ('EV-ANAK-PUTIH-2XL', 'Gudara - Jersey Embos Variasi Setelan Anak Usia 4-12Tahun', 0, 'aktif'),
  ('NFL-90-S', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('NFL-90-M', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('NFL-90-L', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('NFL-24-S', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('NFL-24-M', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('NFL-24-L', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('NFL-00-S', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('NFL-00-M', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('NFL-00-L', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('NFL-99-S', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('NFL-99-M', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('NFL-99-L', 'Gudara - Jersey NFL Number Series Jersey Oversize Laki-Laki Dan Perempuan Jersey Olahraga Bahan Dryfit Full Printing Sublimasi Adem Nyaman Untuk Semua Musim', 0, 'aktif'),
  ('BTW-KUBUS-S', 'Gudara Basic Tee Baju Olahraga Wanita Reguler Fit Dry Fit Running / Sport Waffle Fabric Quick Dry', 0, 'aktif'),
  ('BTW-KUBUS-M', 'Gudara Basic Tee Baju Olahraga Wanita Reguler Fit Dry Fit Running / Sport Waffle Fabric Quick Dry', 0, 'aktif'),
  ('BTW-KUBUS-L', 'Gudara Basic Tee Baju Olahraga Wanita Reguler Fit Dry Fit Running / Sport Waffle Fabric Quick Dry', 0, 'aktif'),
  ('BTW-HITAM-S', 'Gudara Basic Tee Baju Olahraga Wanita Reguler Fit Dry Fit Running / Sport Waffle Fabric Quick Dry', 0, 'aktif'),
  ('BTW-HITAM-M', 'Gudara Basic Tee Baju Olahraga Wanita Reguler Fit Dry Fit Running / Sport Waffle Fabric Quick Dry', 0, 'aktif'),
  ('BTW-HITAM-L', 'Gudara Basic Tee Baju Olahraga Wanita Reguler Fit Dry Fit Running / Sport Waffle Fabric Quick Dry', 0, 'aktif'),
  ('BTW-ABU-S', 'Gudara Basic Tee Baju Olahraga Wanita Reguler Fit Dry Fit Running / Sport Waffle Fabric Quick Dry', 0, 'aktif'),
  ('BTW-ABU-M', 'Gudara Basic Tee Baju Olahraga Wanita Reguler Fit Dry Fit Running / Sport Waffle Fabric Quick Dry', 0, 'aktif'),
  ('BTW-ABU-L', 'Gudara Basic Tee Baju Olahraga Wanita Reguler Fit Dry Fit Running / Sport Waffle Fabric Quick Dry', 0, 'aktif'),
  ('BTM-PUTIH-S', 'Gudara - Basic Tee Kaos Polos Olahraga Reguler Fit Dry Fit Running Gym Pria Regular fit', 0, 'aktif'),
  ('BTM-PUTIH-M', 'Gudara - Basic Tee Kaos Polos Olahraga Reguler Fit Dry Fit Running Gym Pria Regular fit', 0, 'aktif'),
  ('BTM-PUTIH-L', 'Gudara - Basic Tee Kaos Polos Olahraga Reguler Fit Dry Fit Running Gym Pria Regular fit', 0, 'aktif'),
  ('BTM-HITAM-S', 'Gudara - Basic Tee Kaos Polos Olahraga Reguler Fit Dry Fit Running Gym Pria Regular fit', 0, 'aktif'),
  ('BTM-HITAM-M', 'Gudara - Basic Tee Kaos Polos Olahraga Reguler Fit Dry Fit Running Gym Pria Regular fit', 0, 'aktif'),
  ('BTM-HITAM-L', 'Gudara - Basic Tee Kaos Polos Olahraga Reguler Fit Dry Fit Running Gym Pria Regular fit', 0, 'aktif'),
  ('BTM-ABU-S', 'Gudara - Basic Tee Kaos Polos Olahraga Reguler Fit Dry Fit Running Gym Pria Regular fit', 0, 'aktif'),
  ('BTM-ABU-M', 'Gudara - Basic Tee Kaos Polos Olahraga Reguler Fit Dry Fit Running Gym Pria Regular fit', 0, 'aktif'),
  ('BTM-ABU-L', 'Gudara - Basic Tee Kaos Polos Olahraga Reguler Fit Dry Fit Running Gym Pria Regular fit', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-HITAM-XS', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-HITAM-S', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-HITAM-M', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-HITAM-L', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-HITAM-XL', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-HITAM-2XL', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-HITAM-XS', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-HITAM-S', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-HITAM-M', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-HITAM-L', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-HITAM-XL', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-HITAM-2XL', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-PUTIH-XS', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-PUTIH-S', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-PUTIH-M', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-PUTIH-L', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-PUTIH-XL', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-WANGKI-PUTIH-2XL', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-PUTIH-XS', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-PUTIH-S', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-PUTIH-M', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-PUTIH-L', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-PUTIH-XL', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('EV-PANJANG-VNECK-PUTIH-2XL', 'Gudara - Jersey Embos Variasi Olahraga Pria Bahan Dryfit Polos Lengan Panjang', 0, 'aktif'),
  ('FCS', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('FCM', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('FCL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('FCXL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('FC2XL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('AGS', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('AGM', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('AGL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('AGXL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('AG2XL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('KRS', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('KRM', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('KRL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('KRXL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('KR2XL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('PTS', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('PTM', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('PTL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('PTXL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('PT2XL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('BRS', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('BRM', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('BRL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('BRXL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('BR2XL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('JPS', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('JPM', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('JPL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('JPXL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('JP2XL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('SPS', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('SPM', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('SPL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('SPXL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('SP2XL', 'GUDARA Jersey Bola Negara Fantasy Full Printing Sublime Sport', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-ABU-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-ABU-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-ABU-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-ABU-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-ABU-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-ABU-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-ABU-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-ABU-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-ABU-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-ABU-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-ABU-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-ABU-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HITAM-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HITAM-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HITAM-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HITAM-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HITAM-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HITAM-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HITAM-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HITAM-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HITAM-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HITAM-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HITAM-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HITAM-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-PUTIH-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-PUTIH-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-PUTIH-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-PUTIH-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-PUTIH-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-PUTIH-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-PUTIH-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-PUTIH-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-PUTIH-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-PUTIH-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-PUTIH-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-PUTIH-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HIJAU-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HIJAU-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HIJAU-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HIJAU-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HIJAU-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HIJAU-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HIJAU-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HIJAU-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HIJAU-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HIJAU-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-HIJAU-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TOSCA-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-TOSCA-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TOSCA-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-TOSCA-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TOSCA-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-TOSCA-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MAROON-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MAROON-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-BIRU-XS', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-BIRU-XS', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-BIRU-S', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-BIRU-S', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-BIRU-M', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-BIRU-M', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-BIRU-L', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-BIRU-L', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-BIRU-XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-BIRU-XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-BIRU-2XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-BIRU-2XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MERAH-XS', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MERAH-XS', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MERAH-S', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MERAH-S', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MERAH-M', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MERAH-M', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MERAH-L', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MERAH-L', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MERAH-XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MERAH-XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MERAH-2XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MERAH-2XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-GOLD-XS', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-GOLD-XS', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-GOLD-S', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-GOLD-S', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-GOLD-M', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-GOLD-M', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-GOLD-L', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-GOLD-L', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-GOLD-XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-GOLD-XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-GOLD-2XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-GOLD-2XL', 'Gudara - Jersey Polos Embos Variasi  Vol.2 - Elegan dan Sporty dalam Satu Gaya - Olahraga, Pakaian', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TOSCA-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-TOSCA-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TOSCA-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-TOSCA-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-TOSCA-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-TOSCA-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-HIJAU-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-NAVY-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-NAVY-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-NAVY-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-NAVY-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-NAVY-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-NAVY-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-NAVY-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-NAVY-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-NAVY-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-NAVY-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-NAVY-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-NAVY-2XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MAROON-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MAROON-XS', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MAROON-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MAROON-S', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MAROON-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MAROON-M', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MAROON-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MAROON-L', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-WANGKI-MAROON-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif'),
  ('EVA-PENDEK-VNECK-MAROON-XL', 'Gudara - Jersey Embos Polos Variasi Sublimasi Elegan dan Sport, Dryfit Embos Olahraga', 0, 'aktif');
