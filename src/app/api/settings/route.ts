import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import type { D1Database } from "@cloudflare/workers-types";

const DEFAULT_SETTINGS = [
  {
    key: "company_name",
    value: "GUDARA",
    label: "Nama Perusahaan",
    description: "Nama yang tampil pada dokumen cetak dan label internal.",
  },
  {
    key: "due_soon_days",
    value: "2",
    label: "Batas PO Mendekati Due Date",
    description: "Jumlah hari sebelum due date agar PO diberi badge/peringatan.",
  },
  {
    key: "work_week_label",
    value: "Sen-Sab",
    label: "Label Minggu Kerja",
    description: "Label periode kerja untuk laporan setoran jahit.",
  },
  {
    key: "payroll_note",
    value: "Rekap upah berdasarkan setoran jahit yang sudah diinput admin.",
    label: "Catatan Slip Upah",
    description: "Catatan standar yang dipakai admin saat mencetak slip/rekap upah.",
  },
  {
    key: "reset_email_webhook_hint",
    value: "",
    label: "Webhook Email Reset Password",
    description: "Catatan URL webhook email. Nilai operasional tetap disarankan disimpan di env RESET_EMAIL_WEBHOOK_URL.",
  },
  {
    key: "invoice_note",
    value: "Terima kasih atas pesanan Anda.",
    label: "Catatan Invoice",
    description: "Catatan standar yang tampil di bagian bawah invoice pesanan.",
  },
] as const;

type AppSettingRow = {
  id: number;
  key: string;
  value: string;
  label: string;
  description: string | null;
  updatedAt: string;
  createdAt: string;
};

async function ensureDefaultSettings(db: D1Database) {
  // Emulates Prisma's upsert-with-empty-update: insert only if the key is
  // missing, never touch an existing row's value/label/description.
  await db.batch(
    DEFAULT_SETTINGS.map((setting) =>
      db
        .prepare(
          `INSERT INTO app_settings (key, value, label, description, "updatedAt")
           VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT(key) DO NOTHING`
        )
        .bind(setting.key, setting.value, setting.label, setting.description, new Date().toISOString())
    )
  );
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDB();
  await ensureDefaultSettings(db);
  const { results } = await db.prepare(`SELECT * FROM app_settings ORDER BY id ASC`).all<AppSettingRow>();
  return NextResponse.json(results ?? []);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { settings } = await req.json();
  if (!Array.isArray(settings)) {
    return NextResponse.json({ error: "Data setting tidak valid" }, { status: 400 });
  }

  const db = getDB();
  await ensureDefaultSettings(db);

  const { results: existing } = await db.prepare(`SELECT key FROM app_settings`).all<{ key: string }>();
  const allowedKeys = new Set((existing ?? []).map((setting) => setting.key));

  const updates = settings
    .filter((setting: { key?: unknown; value?: unknown }) => typeof setting.key === "string" && allowedKeys.has(setting.key))
    .map((setting: { key: string; value?: unknown }) =>
      db
        .prepare(`UPDATE app_settings SET value = ?1, "updatedAt" = ?2 WHERE key = ?3`)
        .bind(String(setting.value ?? ""), new Date().toISOString(), setting.key)
    );

  if (updates.length > 0) {
    await db.batch(updates);
  }

  const { results: updated } = await db.prepare(`SELECT * FROM app_settings ORDER BY id ASC`).all<AppSettingRow>();
  return NextResponse.json(updated ?? []);
}
