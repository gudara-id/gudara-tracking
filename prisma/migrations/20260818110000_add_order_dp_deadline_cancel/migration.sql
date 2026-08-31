-- Order detail dialog: adds DP/payment tracking, a production deadline, and
-- a dedicated Cancel Order action (separate from the general status buttons)
-- that stamps who cancelled the order, when, and why.

ALTER TABLE "orders" ADD COLUMN "dp_amount" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "deadline" DATETIME;
ALTER TABLE "orders" ADD COLUMN "cancel_reason" TEXT;
ALTER TABLE "orders" ADD COLUMN "cancelled_by" INTEGER;
ALTER TABLE "orders" ADD COLUMN "cancelled_at" DATETIME;

CREATE INDEX IF NOT EXISTS "orders_deadline_idx" ON "orders"("deadline");
