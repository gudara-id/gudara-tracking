-- Configurable kanban stages for the production board (replaces the
-- previously hardcoded KANBAN_PO_STATUSES list), plus per-PO members
-- and checklist items for the "Add / Checklist / Members" card actions.

CREATE TABLE "production_stages" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nama" TEXT NOT NULL,
  "urutan" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "production_stages_nama_key" ON "production_stages"("nama");
CREATE INDEX "production_stages_urutan_idx" ON "production_stages"("urutan");

INSERT INTO "production_stages" ("nama", "urutan") VALUES
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

CREATE TABLE "po_members" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "po_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "po_members_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "po_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "po_members_po_id_user_id_key" ON "po_members"("po_id", "user_id");
CREATE INDEX "po_members_po_id_idx" ON "po_members"("po_id");

CREATE TABLE "po_checklist_items" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "po_id" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "is_done" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "po_checklist_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "po_checklist_items_po_id_idx" ON "po_checklist_items"("po_id");
