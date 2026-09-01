-- Merge role admin_produksi & admin_jahit into a single role: admin_operasional.
-- No schema change (role is a plain TEXT column) — this only rewrites existing
-- user rows so accounts keep working after the app code deploy.
-- Apply with:
--   npx wrangler d1 execute gudara-db --local  --file=./migration_merge_admin_roles.sql
--   npx wrangler d1 execute gudara-db --remote --file=./migration_merge_admin_roles.sql

UPDATE "users"
SET "role" = 'admin_operasional'
WHERE "role" IN ('admin_produksi', 'admin_jahit');
