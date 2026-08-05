import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { isUserRole } from "@/lib/validators";


export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username dan password wajib diisi" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "Username atau password salah" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Username atau password salah" }, { status: 401 });
  }

  if (!isUserRole(user.role)) {
    return NextResponse.json({ error: "Role user tidak valid" }, { status: 500 });
  }

  await createSession({
    userId: user.id,
    username: user.username,
    role: user.role,
    nama_lengkap: user.nama_lengkap,
  });

  const redirectTo =
    user.role === "admin_produksi" ? "/produksi" : user.role === "admin_jahit" ? "/jahit" : "/operator-jahit";
  return NextResponse.json({ redirectTo });
}
