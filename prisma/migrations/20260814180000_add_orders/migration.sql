-- Order section: public order form (shareable link, no login) + invoice.
-- A customer fills the form at /order-form, which creates an "order" header
-- row plus one "order_items" row per product line. Admin (admin_produksi)
-- reviews/confirms it from the new /order dashboard and can print an
-- invoice from it. Snapshotting nama_artikel/harga_satuan on order_items
-- mirrors the existing purchase_order_articles pattern, so later edits to
-- the artikel master don't rewrite an already-submitted order's numbers.

CREATE TABLE "orders" (
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
CREATE UNIQUE INDEX "orders_nomor_order_key" ON "orders"("nomor_order");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

CREATE TABLE "order_items" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "order_id" INTEGER NOT NULL,
  "artikel_id" INTEGER,
  "nama_artikel" TEXT NOT NULL,
  "harga_satuan" DECIMAL NOT NULL,
  "qty" INTEGER NOT NULL,
  "subtotal" DECIMAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE,
  CONSTRAINT "order_items_artikel_id_fkey" FOREIGN KEY ("artikel_id") REFERENCES "artikels" ("id") ON DELETE SET NULL
);
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX "order_items_artikel_id_idx" ON "order_items"("artikel_id");

INSERT OR IGNORE INTO "app_settings" ("key", "value", "label", "description", "updatedAt")
VALUES
  ('invoice_note', 'Terima kasih atas pesanan Anda.', 'Catatan Invoice', 'Catatan standar yang tampil di bagian bawah invoice pesanan.', CURRENT_TIMESTAMP);
