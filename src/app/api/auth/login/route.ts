import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/d1'
import { verifyPassword } from '@/lib/password'
import { createSession } from '@/lib/auth'

function redirectForRole(role: string) {
  if (role === 'admin_produksi') return '/produksi';
  if (role === 'admin_jahit') return '/jahit';
  if (role === 'operator_jahit') return '/operator-jahit';
  if (role === 'operator_produksi') return '/operator-produksi';
  if (role === 'kurir') return '/kurir';
  if (role === 'sales') return '/order';
  return '/';
}

// Row shape returned by the raw D1 query below (subset of the `users` table).
type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  nama_lengkap: string;
};

// Memaksa API menjadi dinamis
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const db = getDB();

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    // Direct D1 query — see src/lib/d1.ts for why this route no longer uses Prisma.
    const user = await db
      .prepare(
        `SELECT id, username, password_hash, role, nama_lengkap FROM users WHERE username = ?1`
      )
      .bind(username)
      .first<UserRow>();

    if (!user) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    await createSession({
      userId: user.id,
      username: user.username,
      role: user.role as "admin_produksi" | "admin_jahit" | "operator_jahit" | "operator_produksi" | "kurir" | "sales",
      nama_lengkap: user.nama_lengkap,
    });

    return NextResponse.json({
      message: "Login berhasil",
      redirectTo: redirectForRole(user.role),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        nama_lengkap: user.nama_lengkap
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Login Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server.", details: error.message },
      { status: 500 }
    );
  }
}
