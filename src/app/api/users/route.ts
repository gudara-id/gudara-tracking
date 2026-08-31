import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isUserRole, isValidEmail } from "@/lib/validators";
import { recordActivity } from "@/lib/activity";

type PublicUserRow = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  nama_lengkap: string;
  avatar_url: string | null;
  createdAt: string;
};

const PUBLIC_FIELDS = `id, username, email, role, nama_lengkap, avatar_url, "createdAt"`;

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDB();
  const { results } = await db
    .prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY "createdAt" DESC`)
    .all<PublicUserRow>();
  return NextResponse.json(results ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, password, role, nama_lengkap, email } = await req.json();
  if (!username || !password || !nama_lengkap || !isUserRole(role)) {
    return NextResponse.json({ error: "Username, password, nama, dan role valid wajib diisi" }, { status: 400 });
  }
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
  }

  const db = getDB();

  try {
    const user = await db
      .prepare(
        `INSERT INTO users (username, password_hash, role, nama_lengkap, email) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING ${PUBLIC_FIELDS}`
      )
      .bind(username, await hashPassword(password), role, nama_lengkap, email || null)
      .first<PublicUserRow>();

    return NextResponse.json(user, { status: 201 });
  } catch (err: unknown) {
    const message = String(err);
    if (message.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "Username atau email sudah digunakan" }, { status: 409 });
    }
    return NextResponse.json({ error: "Gagal menambah user" }, { status: 500 });
  }
}

/** Admin-driven password reset, for when a user is locked out and the
 * forgot-password email flow (RESET_EMAIL_WEBHOOK_URL) isn't set up or
 * isn't reaching the user. Only admin_produksi can do this. */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, newPassword } = await req.json();
  const userId = Number(id);
  if (!userId) return NextResponse.json({ error: "ID user wajib diisi" }, { status: 400 });
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400 });
  }

  const db = getDB();
  const target = await db
    .prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?1`)
    .bind(userId)
    .first<PublicUserRow>();
  if (!target) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  await db.prepare(`UPDATE users SET password_hash = ?1 WHERE id = ?2`).bind(await hashPassword(newPassword), userId).run();
  // Invalidate any outstanding self-service reset links for this user so an
  // old email link can't later overwrite the password the admin just set.
  await db.prepare(`DELETE FROM password_reset_tokens WHERE user_id = ?1`).bind(userId).run();

  await recordActivity({
    session,
    entity: "auth",
    entityId: userId,
    action: "admin_reset_password",
    summary: `Password user "${target.username}" direset oleh admin`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID user wajib diisi" }, { status: 400 });
  if (id === session.userId) return NextResponse.json({ error: "User yang sedang login tidak bisa dihapus" }, { status: 400 });

  const db = getDB();
  try {
    await db.prepare(`DELETE FROM users WHERE id = ?1`).bind(id).run();
  } catch {
    return NextResponse.json({ error: "User sudah memiliki histori transaksi/PO sehingga tidak bisa dihapus" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
