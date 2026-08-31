CREATE TABLE "app_settings" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "updatedAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

INSERT INTO "app_settings" ("key", "value", "label", "description", "updatedAt")
VALUES
  ('company_name', 'GUDARA', 'Nama Perusahaan', 'Nama yang tampil pada dokumen cetak dan label internal.', CURRENT_TIMESTAMP),
  ('due_soon_days', '2', 'Batas PO Mendekati Due Date', 'Jumlah hari sebelum due date agar PO diberi badge/peringatan.', CURRENT_TIMESTAMP),
  ('work_week_label', 'Sen-Sab', 'Label Minggu Kerja', 'Label periode kerja untuk laporan setoran jahit.', CURRENT_TIMESTAMP),
  ('payroll_note', 'Rekap upah berdasarkan setoran jahit yang sudah diinput admin.', 'Catatan Slip Upah', 'Catatan standar yang dipakai admin saat mencetak slip/rekap upah.', CURRENT_TIMESTAMP),
  ('reset_email_webhook_hint', '', 'Webhook Email Reset Password', 'Catatan URL webhook email. Nilai operasional tetap disarankan disimpan di env RESET_EMAIL_WEBHOOK_URL.', CURRENT_TIMESTAMP);
