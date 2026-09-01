import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";

type StageRow = {
  id: number;
  nama: string;
  urutan: number;
  createdAt: string;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDB();
    const { results } = await db.prepare(`SELECT * FROM production_stages ORDER BY urutan ASC`).all<StageRow>();
    return NextResponse.json(results ?? []);
  } catch (err: unknown) {
    console.error("GET /api/tahapan failed", err);
    return NextResponse.json(
      { error: "Gagal memuat tahapan produksi. Pastikan migrasi database (production_stages) sudah dijalankan." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_operasional") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nama } = await req.json();
  const trimmed = String(nama ?? "").trim().toUpperCase();
  if (!trimmed) {
    return NextResponse.json({ error: "Nama tahapan wajib diisi" }, { status: 400 });
  }

  try {
    const db = getDB();
    const maxRow = await db.prepare(`SELECT COALESCE(MAX(urutan), 0) as maxUrutan FROM production_stages`).first<{ maxUrutan: number }>();

    const stage = await db
      .prepare(`INSERT INTO production_stages (nama, urutan) VALUES (?1, ?2) RETURNING *`)
      .bind(trimmed, (maxRow?.maxUrutan ?? 0) + 1)
      .first<StageRow>();
    return NextResponse.json(stage, { status: 201 });
  } catch (err: unknown) {
    if (String(err).includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "Tahapan dengan nama tersebut sudah ada" }, { status: 409 });
    }
    console.error("POST /api/tahapan failed", err);
    return NextResponse.json(
      { error: "Gagal menambah tahapan. Pastikan migrasi database (production_stages) sudah dijalankan." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_operasional") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, nama, direction } = await req.json();
  const stageId = Number(id);
  if (!stageId) return NextResponse.json({ error: "ID tahapan wajib diisi" }, { status: 400 });

  try {
    const db = getDB();

    if (direction === "up" || direction === "down") {
      const { results } = await db.prepare(`SELECT * FROM production_stages ORDER BY urutan ASC`).all<StageRow>();
      const stages = results ?? [];
      const index = stages.findIndex((stage) => stage.id === stageId);
      if (index === -1) return NextResponse.json({ error: "Tahapan tidak ditemukan" }, { status: 404 });
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= stages.length) {
        return NextResponse.json(stages);
      }
      const a = stages[index];
      const b = stages[swapIndex];
      await db.batch([
        db.prepare(`UPDATE production_stages SET urutan = ?1 WHERE id = ?2`).bind(b.urutan, a.id),
        db.prepare(`UPDATE production_stages SET urutan = ?1 WHERE id = ?2`).bind(a.urutan, b.id),
      ]);
      const { results: reordered } = await db.prepare(`SELECT * FROM production_stages ORDER BY urutan ASC`).all<StageRow>();
      return NextResponse.json(reordered ?? []);
    }

    if (nama !== undefined) {
      const trimmed = String(nama).trim().toUpperCase();
      if (!trimmed) return NextResponse.json({ error: "Nama tahapan wajib diisi" }, { status: 400 });

      const existing = await db.prepare(`SELECT * FROM production_stages WHERE id = ?1`).bind(stageId).first<StageRow>();
      if (!existing) return NextResponse.json({ error: "Tahapan tidak ditemukan" }, { status: 404 });

      try {
        if (trimmed !== existing.nama) {
          await db.batch([
            db.prepare(`UPDATE production_stages SET nama = ?1 WHERE id = ?2`).bind(trimmed, stageId),
            // Keep PO's currently sitting on this stage pointed at the renamed value.
            db.prepare(`UPDATE purchase_orders SET status = ?1 WHERE status = ?2`).bind(trimmed, existing.nama),
          ]);
        }
      } catch (err: unknown) {
        if (String(err).includes("UNIQUE constraint")) {
          return NextResponse.json({ error: "Tahapan dengan nama tersebut sudah ada" }, { status: 409 });
        }
        throw err;
      }

      const updated = await db.prepare(`SELECT * FROM production_stages WHERE id = ?1`).bind(stageId).first<StageRow>();
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim" }, { status: 400 });
  } catch (err: unknown) {
    console.error("PATCH /api/tahapan failed", err);
    return NextResponse.json({ error: "Gagal mengubah tahapan produksi" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_operasional") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID tahapan wajib diisi" }, { status: 400 });

  try {
    const db = getDB();
    const stage = await db.prepare(`SELECT * FROM production_stages WHERE id = ?1`).bind(id).first<StageRow>();
    if (!stage) return NextResponse.json({ error: "Tahapan tidak ditemukan" }, { status: 404 });

    const inUse = await db
      .prepare(`SELECT COUNT(*) as count FROM purchase_orders WHERE status = ?1`)
      .bind(stage.nama)
      .first<{ count: number }>();
    if ((inUse?.count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Tahapan "${stage.nama}" masih dipakai oleh ${inUse?.count} PO, pindahkan PO tersebut dahulu` },
        { status: 409 }
      );
    }

    const countRow = await db.prepare(`SELECT COUNT(*) as count FROM production_stages`).first<{ count: number }>();
    if ((countRow?.count ?? 0) <= 1) {
      return NextResponse.json({ error: "Minimal harus ada 1 tahapan produksi" }, { status: 409 });
    }

    await db.prepare(`DELETE FROM production_stages WHERE id = ?1`).bind(id).run();
    const { results } = await db.prepare(`SELECT * FROM production_stages ORDER BY urutan ASC`).all<StageRow>();
    return NextResponse.json(results ?? []);
  } catch (err: unknown) {
    console.error("DELETE /api/tahapan failed", err);
    return NextResponse.json({ error: "Gagal menghapus tahapan produksi" }, { status: 500 });
  }
}
