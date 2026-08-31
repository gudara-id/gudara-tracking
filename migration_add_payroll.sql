-- Migrasi TAMBAHAN untuk fitur Payroll (kode aplikasinya sudah ada,
-- tinggal tabel database ini yang belum pernah dibuat di D1 production).
-- Aman dijalankan meski tabel lain sudah ada (pakai IF NOT EXISTS).
--
-- Jalankan dengan:
--   npx wrangler d1 execute gudara-db --remote --file=./migration_add_payroll.sql

CREATE TABLE IF NOT EXISTS "payroll_periods" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "label" TEXT NOT NULL,
  "start_date" DATETIME NOT NULL,
  "end_date" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "created_by" INTEGER NOT NULL,
  "paid_by" INTEGER,
  "paid_at" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_periods_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id"),
  CONSTRAINT "payroll_periods_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "users" ("id")
);
CREATE INDEX IF NOT EXISTS "payroll_periods_start_date_idx" ON "payroll_periods"("start_date");

CREATE TABLE IF NOT EXISTS "payroll_adjustments" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "period_id" INTEGER NOT NULL,
  "operator_id" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  "created_by" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_adjustments_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods" ("id") ON DELETE CASCADE,
  CONSTRAINT "payroll_adjustments_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators" ("id"),
  CONSTRAINT "payroll_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id")
);
CREATE INDEX IF NOT EXISTS "payroll_adjustments_period_id_idx" ON "payroll_adjustments"("period_id");
CREATE INDEX IF NOT EXISTS "payroll_adjustments_operator_id_idx" ON "payroll_adjustments"("operator_id");
