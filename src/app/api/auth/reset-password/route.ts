import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDB } from "@/lib/d1";
import { hashPassword } from "@/lib/password";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

type ResetTokenRow = {
  id: number;
  user_id: number;
  usedAt: string | null;
  expiresAt: string; // ISO string, as stored by D1/Prisma for DATETIME columns
};

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token reset tidak valid" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }

  const db = getDB();

  const resetToken = await db
    .prepare(`SELECT id, user_id, "usedAt", "expiresAt" FROM password_reset_tokens WHERE token_hash = ?1`)
    .bind(hashToken(token))
    .first<ResetTokenRow>();

  // ISO 8601 strings compare correctly lexicographically, so a plain string
  // comparison here is equivalent to the previous `resetToken.expiresAt < new Date()`.
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date().toISOString()) {
    return NextResponse.json({ error: "Link reset sudah tidak berlaku" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  // D1's batch() runs its statements sequentially inside an implicit
  // transaction, matching the atomicity of the previous prisma.$transaction([...]).
  await db.batch([
    db.prepare(`UPDATE users SET password_hash = ?1 WHERE id = ?2`).bind(passwordHash, resetToken.user_id),
    db
      .prepare(`UPDATE password_reset_tokens SET "usedAt" = ?1 WHERE id = ?2`)
      .bind(new Date().toISOString(), resetToken.id),
  ]);

  return NextResponse.json({ message: "Password berhasil direset. Silakan login kembali." });
}
