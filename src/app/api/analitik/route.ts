import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/d1";
import { getSession } from "@/lib/auth";
import { decimalToNumber } from "@/lib/utils";
import type { D1Database } from "@cloudflare/workers-types";

type StageConfigRow = { nama: string; urutan: number };

type PoSnapshotRow = {
  id: number;
  status: string;
  createdAt: string;
  last_change_at: string | null;
};

type ActivityLogRow = {
  id: number;
  entity_id: number | null;
  action: string;
  metadata: string | null;
  createdAt: string;
};

type ArtikelAggRow = {
  nama_artikel: string;
  total_qty: number | null;
  total_upah: number | null;
  po_count: number | null;
};

/** Resolves the request's start/end query params into an inclusive day range. Defaults to the last 30 days. */
function resolveRange(req: NextRequest) {
  const startParam = req.nextUrl.searchParams.get("start");
  const endParam = req.nextUrl.searchParams.get("end");

  const endSource = endParam ? new Date(endParam) : new Date();
  const startSource = startParam ? new Date(startParam) : new Date(endSource.getTime() - 29 * 24 * 60 * 60 * 1000);

  const startOfDay = new Date(startSource);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(endSource);
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
}

async function loadStages(db: D1Database) {
  try {
    const { results } = await db.prepare(`SELECT nama, urutan FROM production_stages ORDER BY urutan ASC`).all<StageConfigRow>();
    return results ?? [];
  } catch (err) {
    console.error("GET /api/analitik: could not load production_stages", err);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin_produksi") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDB();
    const { startOfDay, endOfDay } = resolveRange(req);
    const startIso = startOfDay.toISOString();
    const endIso = endOfDay.toISOString();

    const stages = await loadStages(db);
    const urutanByStage = new Map(stages.map((s) => [s.nama, s.urutan]));
    const terminalStage = stages.length ? stages[stages.length - 1].nama : "TERKIRIM";
    const isTerminal = (status: string) => status === "selesai" || status === terminalStage;

    // ---------- 1) Backlog saat ini per tahapan (di mana PO menumpuk) ----------
    const { results: snapshot } = await db
      .prepare(
        `SELECT po.id, po.status, po.createdAt,
                (SELECT MAX(l."createdAt") FROM activity_logs l
                  WHERE l.entity = 'po' AND l.entity_id = po.id AND l.action = 'po_status_changed') AS last_change_at
         FROM purchase_orders po`
      )
      .all<PoSnapshotRow>();

    const now = Date.now();
    const backlogByStage = new Map<string, { count: number; oldestAgeHours: number }>();
    for (const po of snapshot ?? []) {
      if (isTerminal(po.status)) continue; // sudah selesai/terkirim, bukan "macet"
      const since = new Date(po.last_change_at ?? po.createdAt).getTime();
      const ageHours = Math.max(0, (now - since) / 3_600_000);
      const entry = backlogByStage.get(po.status) ?? { count: 0, oldestAgeHours: 0 };
      entry.count += 1;
      entry.oldestAgeHours = Math.max(entry.oldestAgeHours, ageHours);
      backlogByStage.set(po.status, entry);
    }
    const stageBacklog = Array.from(backlogByStage.entries())
      .map(([stage, data]) => ({
        stage,
        urutan: urutanByStage.get(stage) ?? 999,
        count: data.count,
        oldestAgeHours: Math.round(data.oldestAgeHours),
      }))
      .sort((a, b) => a.urutan - b.urutan);

    // ---------- 2) Rata-rata waktu per tahapan (histori, dari log perpindahan) ----------
    const { results: poCreatedLogs } = await db
      .prepare(`SELECT id, entity_id, action, metadata, "createdAt" FROM activity_logs WHERE entity = 'po' AND action = 'po_created'`)
      .all<ActivityLogRow>();
    const { results: statusChangedLogs } = await db
      .prepare(
        `SELECT id, entity_id, action, metadata, "createdAt" FROM activity_logs WHERE entity = 'po' AND action = 'po_status_changed' ORDER BY entity_id ASC, "createdAt" ASC`
      )
      .all<ActivityLogRow>();

    type TimelineEvent = { time: number; status: string };
    const timelineByPo = new Map<number, TimelineEvent[]>();

    for (const row of poCreatedLogs ?? []) {
      if (row.entity_id === null) continue;
      let status = stages[0]?.nama ?? "PRINT PO TINGKING";
      try {
        const meta = row.metadata ? JSON.parse(row.metadata) : null;
        if (meta?.status) status = meta.status;
      } catch {
        // metadata tidak valid JSON — pakai fallback di atas
      }
      const list = timelineByPo.get(row.entity_id) ?? [];
      list.push({ time: new Date(row.createdAt).getTime(), status });
      timelineByPo.set(row.entity_id, list);
    }
    for (const row of statusChangedLogs ?? []) {
      if (row.entity_id === null) continue;
      let afterStatus: string | null = null;
      try {
        const meta = row.metadata ? JSON.parse(row.metadata) : null;
        afterStatus = meta?.afterStatus ?? null;
      } catch {
        afterStatus = null;
      }
      if (!afterStatus) continue; // log ini murni perubahan label/deskripsi, bukan pindah tahapan
      const list = timelineByPo.get(row.entity_id) ?? [];
      list.push({ time: new Date(row.createdAt).getTime(), status: afterStatus });
      timelineByPo.set(row.entity_id, list);
    }

    const durationsByStage = new Map<string, { totalHours: number; samples: number }>();
    for (const events of timelineByPo.values()) {
      events.sort((a, b) => a.time - b.time);
      for (let i = 0; i < events.length - 1; i++) {
        const intervalEndsAt = events[i + 1].time;
        // Hanya hitung transisi yang "selesai" (keluar dari tahapan) di dalam rentang periode dipilih.
        if (intervalEndsAt < startOfDay.getTime() || intervalEndsAt > endOfDay.getTime()) continue;
        const hours = Math.max(0, (intervalEndsAt - events[i].time) / 3_600_000);
        const entry = durationsByStage.get(events[i].status) ?? { totalHours: 0, samples: 0 };
        entry.totalHours += hours;
        entry.samples += 1;
        durationsByStage.set(events[i].status, entry);
      }
    }
    const stageAvgDuration = Array.from(durationsByStage.entries())
      .map(([stage, data]) => ({
        stage,
        urutan: urutanByStage.get(stage) ?? 999,
        avgHours: Math.round((data.totalHours / data.samples) * 10) / 10,
        samples: data.samples,
      }))
      .sort((a, b) => a.urutan - b.urutan);

    // ---------- 3) Rata-rata waktu PO dari masuk sampai selesai ----------
    const cycleDurationsDays: number[] = [];
    for (const [poId, events] of timelineByPo.entries()) {
      events.sort((a, b) => a.time - b.time);
      const created = events[0];
      const lastTerminalEvent = [...events].reverse().find((e) => isTerminal(e.status));
      if (!created || !lastTerminalEvent || lastTerminalEvent === created) continue;
      if (lastTerminalEvent.time < startOfDay.getTime() || lastTerminalEvent.time > endOfDay.getTime()) continue;
      void poId;
      cycleDurationsDays.push((lastTerminalEvent.time - created.time) / 86_400_000);
    }
    const cycleTime = cycleDurationsDays.length
      ? {
          avgDays: Math.round((cycleDurationsDays.reduce((a, b) => a + b, 0) / cycleDurationsDays.length) * 10) / 10,
          minDays: Math.round(Math.min(...cycleDurationsDays) * 10) / 10,
          maxDays: Math.round(Math.max(...cycleDurationsDays) * 10) / 10,
          completedCount: cycleDurationsDays.length,
        }
      : { avgDays: 0, minDays: 0, maxDays: 0, completedCount: 0 };

    // ---------- 4) Performa per artikel (dari setoran dalam periode) ----------
    const { results: artikelAgg } = await db
      .prepare(
        `SELECT po.nama_artikel AS nama_artikel,
                SUM(s.qty_disetor) AS total_qty,
                SUM(s.total_upah) AS total_upah,
                COUNT(DISTINCT s.po_id) AS po_count
         FROM setoran_jahit s
         JOIN purchase_orders po ON po.id = s.po_id
         WHERE s.tanggal_setoran >= ?1 AND s.tanggal_setoran <= ?2
         GROUP BY po.nama_artikel
         ORDER BY total_upah DESC`
      )
      .bind(startIso, endIso)
      .all<ArtikelAggRow>();

    const artikelPerformance = (artikelAgg ?? []).map((row) => {
      const totalQty = Number(row.total_qty ?? 0);
      const totalUpah = decimalToNumber(row.total_upah ?? 0);
      return {
        nama_artikel: row.nama_artikel,
        totalQty,
        totalUpah,
        poCount: Number(row.po_count ?? 0),
        avgHargaSatuan: totalQty > 0 ? Math.round(totalUpah / totalQty) : 0,
      };
    });

    // ---------- 5) Ringkasan total ----------
    const poCreatedInRange = (poCreatedLogs ?? []).filter((row) => {
      const t = new Date(row.createdAt).getTime();
      return t >= startOfDay.getTime() && t <= endOfDay.getTime();
    }).length;

    const totals = {
      poCreated: poCreatedInRange,
      poCompleted: cycleTime.completedCount,
      totalSetoranQty: artikelPerformance.reduce((sum, a) => sum + a.totalQty, 0),
      totalUpah: artikelPerformance.reduce((sum, a) => sum + a.totalUpah, 0),
    };

    return NextResponse.json({
      range: { start: startIso, end: endIso },
      stageBacklog,
      stageAvgDuration,
      cycleTime,
      artikelPerformance,
      totals,
    });
  } catch (err: unknown) {
    console.error("GET /api/analitik failed", err);
    return NextResponse.json({ error: "Gagal memuat data analitik" }, { status: 500 });
  }
}
