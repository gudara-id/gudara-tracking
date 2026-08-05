-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "nama_lengkap" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "artikels" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kode_artikel" TEXT,
    "nama_artikel" TEXT NOT NULL,
    "harga_satuan" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aktif',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "operators" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barcode_operator" TEXT NOT NULL,
    "nama_operator" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aktif',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
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
    CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_order_articles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "po_id" INTEGER NOT NULL,
    "artikel_id" INTEGER,
    "nama_artikel" TEXT NOT NULL,
    "harga_satuan" DECIMAL NOT NULL,
    "qty" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_order_articles_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_order_articles_artikel_id_fkey" FOREIGN KEY ("artikel_id") REFERENCES "artikels" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_order_attachments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "po_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_order_attachments_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "setoran_jahit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tanggal_setoran" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operator_id" INTEGER NOT NULL,
    "po_id" INTEGER NOT NULL,
    "qty_disetor" INTEGER NOT NULL,
    "harga_satuan_snapshot" DECIMAL NOT NULL,
    "total_upah" DECIMAL NOT NULL,
    "admin_jahit_id" INTEGER NOT NULL,
    CONSTRAINT "setoran_jahit_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "setoran_jahit_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "setoran_jahit_admin_jahit_id_fkey" FOREIGN KEY ("admin_jahit_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "artikels_kode_artikel_key" ON "artikels"("kode_artikel");

-- CreateIndex
CREATE UNIQUE INDEX "artikels_nama_artikel_key" ON "artikels"("nama_artikel");

-- CreateIndex
CREATE UNIQUE INDEX "operators_barcode_operator_key" ON "operators"("barcode_operator");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_nomor_po_key" ON "purchase_orders"("nomor_po");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_barcode_po_key" ON "purchase_orders"("barcode_po");

-- CreateIndex
CREATE INDEX "purchase_order_articles_po_id_idx" ON "purchase_order_articles"("po_id");

-- CreateIndex
CREATE INDEX "purchase_order_articles_artikel_id_idx" ON "purchase_order_articles"("artikel_id");

-- CreateIndex
CREATE INDEX "purchase_order_attachments_po_id_idx" ON "purchase_order_attachments"("po_id");

-- CreateIndex
CREATE INDEX "setoran_jahit_tanggal_setoran_idx" ON "setoran_jahit"("tanggal_setoran");

-- CreateIndex
CREATE INDEX "setoran_jahit_operator_id_idx" ON "setoran_jahit"("operator_id");

-- CreateIndex
CREATE INDEX "setoran_jahit_po_id_idx" ON "setoran_jahit"("po_id");
