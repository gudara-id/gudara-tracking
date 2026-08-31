import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDB } from "@/lib/d1";
import { isValidEmail } from "@/lib/validators";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendResetEmail(email: string, resetUrl: string) {
  const webhookUrl = process.env.RESET_EMAIL_WEBHOOK_URL;
  if (!webhookUrl) return false;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: email,
      subject: "Reset password GUDARA Tracker",
      text: `Klik link ini untuk reset password GUDARA Tracker: ${resetUrl}`,
      resetUrl,
    }),
  });
  return true;
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!isValidEmail(normalizedEmail)) {
    return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
  }

  const db = getDB();

  // Match Prisma's previous case-insensitive comparison: pull id+email for all
  // non-null emails and compare normalized in JS, rather than relying on
  // SQLite's default (ASCII-only) LOWER() inside SQL.
  const { results } = await db
    .prepare(`SELECT id, email FROM users WHERE email IS NOT NULL`)
    .all<{ id: number; email: string }>();
  const user = (results ?? []).find((item) => item.email?.trim().toLowerCase() === normalizedEmail);

  let devResetUrl: string | undefined;
  let emailSent = false;

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await db
      .prepare(
        `INSERT INTO password_reset_tokens (user_id, token_hash, "expiresAt") VALUES (?1, ?2, ?3)`
      )
      .bind(user.id, hashToken(token), expiresAt.toISOString())
      .run();

    const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const resetUrl = `${origin}/reset-password?token=${token}`;
    devResetUrl = resetUrl;
    try {
      emailSent = await sendResetEmail(user.email!, resetUrl);
    } catch {
      emailSent = false;
    }
  }

  return NextResponse.json({
    message: "Jika email terdaftar, link reset password akan dikirim.",
    emailSent,
    ...(process.env.NODE_ENV !== "production" && devResetUrl ? { devResetUrl } : {}),
  });
}
