import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isUserRole } from "@/lib/validators";


export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, role: true, nama_lengkap: true, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, password, role, nama_lengkap } = await req.json();
  if (!username || !password || !nama_lengkap || !isUserRole(role)) {
    return NextResponse.json({ error: "Username, password, nama, dan role valid wajib diisi" }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      username,
      password_hash: await hashPassword(password),
      role,
      nama_lengkap,
    },
    select: { id: true, username: true, role: true, nama_lengkap: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID user wajib diisi" }, { status: 400 });
  if (id === session.userId) return NextResponse.json({ error: "User yang sedang login tidak bisa dihapus" }, { status: 400 });

  try {
    await prisma.user.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "User sudah memiliki histori transaksi/PO sehingga tidak bisa dihapus" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
