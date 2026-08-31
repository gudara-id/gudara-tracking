import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Password saat ini dan password baru wajib diisi" }, { status: 400 });
  }
  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400 });
  }

  const db = getDB();

  const user = await db
    .prepare(`SELECT id, password_hash FROM users WHERE id = ?1`)
    .bind(session.userId)
    .first<{ id: number; password_hash: string }>();
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Password saat ini salah" }, { status: 401 });
  }

  await db
    .prepare(`UPDATE users SET password_hash = ?1 WHERE id = ?2`)
    .bind(await hashPassword(newPassword), user.id)
    .run();

  return NextResponse.json({ ok: true });
}
