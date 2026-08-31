import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { createSession, getSession } from "@/lib/auth";
import { isValidEmail } from "@/lib/validators";

type MeRow = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  nama_lengkap: string;
  avatar_url: string | null;
  createdAt: string;
};

const SELECT_ME = `SELECT id, username, email, role, nama_lengkap, avatar_url, "createdAt" FROM users WHERE id = ?1`;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB();
  const user = await db.prepare(SELECT_ME).bind(session.userId).first<MeRow>();
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nama_lengkap, email, avatar_url } = await req.json();

  if (nama_lengkap !== undefined && !String(nama_lengkap).trim()) {
    return NextResponse.json({ error: "Nama lengkap tidak boleh kosong" }, { status: 400 });
  }
  if (email !== undefined && email !== null && email !== "" && !isValidEmail(email)) {
    return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
  }
  // Simple guard against storing an oversized avatar (e.g. accidental huge base64 upload)
  if (avatar_url !== undefined && avatar_url !== null && String(avatar_url).length > 1_500_000) {
    return NextResponse.json({ error: "Ukuran foto profil terlalu besar" }, { status: 400 });
  }

  const db = getDB();

  try {
    // Build the SET clause dynamically to match Prisma's "only update given fields" behavior.
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (nama_lengkap !== undefined) {
      sets.push(`nama_lengkap = ?${i++}`);
      values.push(String(nama_lengkap).trim());
    }
    if (email !== undefined) {
      sets.push(`email = ?${i++}`);
      values.push(email === "" ? null : email);
    }
    if (avatar_url !== undefined) {
      sets.push(`avatar_url = ?${i++}`);
      values.push(avatar_url === "" ? null : avatar_url);
    }

    if (sets.length > 0) {
      values.push(session.userId);
      await db
        .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?${i}`)
        .bind(...values)
        .run();
    }

    const updated = await db.prepare(SELECT_ME).bind(session.userId).first<MeRow>();
    if (!updated) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    // Keep the session cookie in sync so server-rendered pages (e.g. "Halo, {nama}")
    // reflect the change immediately without requiring a fresh login.
    await createSession({
      userId: updated.id,
      username: updated.username,
      role: session.role,
      nama_lengkap: updated.nama_lengkap,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = String(err);
    if (message.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "Email sudah digunakan akun lain" }, { status: 409 });
    }
    return NextResponse.json({ error: "Gagal memperbarui profil" }, { status: 500 });
  }
}
