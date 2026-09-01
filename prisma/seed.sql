-- GUDARA Production & Sewing Tracker - demo seed data for D1
-- Apply with: wrangler d1 execute gudara-db --remote --file=./prisma/seed.sql
-- Password for both demo logins below is: gudara123

INSERT INTO "users" ("username", "password_hash", "role", "nama_lengkap") VALUES
  ('produksi', '$2a$10$WHRtxohKYCc6trHjgMAj2uPpjzTEfr4lSjSLmuHN0XFrRKgAHciCW', 'admin_produksi', 'Admin Produksi'),
  ('jahit', '$2a$10$WHRtxohKYCc6trHjgMAj2uPpjzTEfr4lSjSLmuHN0XFrRKgAHciCW', 'admin_jahit', 'Admin Jahit'),
  ('cutting', '$2a$10$WHRtxohKYCc6trHjgMAj2uPpjzTEfr4lSjSLmuHN0XFrRKgAHciCW', 'admin_cutting', 'Admin Cutting');

INSERT INTO "operators" ("barcode_operator", "nama_operator", "status") VALUES
  ('OP-0001', 'Siti Rahayu', 'aktif'),
  ('OP-0002', 'Dewi Lestari', 'aktif'),
  ('OP-0003', 'Ani Kurniawati', 'aktif');

INSERT INTO "purchase_orders" ("nomor_po", "barcode_po", "nama_po", "nama_artikel", "harga_satuan", "target_qty", "status", "created_by")
VALUES (
  'PO-20260804-0001',
  'GDR-PO-2026080400001',
  'Jersey Embos Variasi Lengan Panjang',
  'Jersey Embos',
  8500,
  300,
  'berjalan',
  (SELECT "id" FROM "users" WHERE "username" = 'produksi')
);
