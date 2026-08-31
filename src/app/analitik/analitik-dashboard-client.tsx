"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, BarChart3, Clock, PackageCheck, ShirtIcon, TrendingUp } from "lucide-react";
import Sidebar from "@/components/Sidebar";

type StageBacklog = { stage: string; urutan: number; count: number; oldestAgeHours: number };
type StageAvgDuration = { stage: string; urutan: number; avgHours: number; samples: number };
type CycleTime = { avgDays: number; minDays: number; maxDays: number; completedCount: number };
type ArtikelPerformance = {
  nama_artikel: string;
  totalQty: number;
  totalUpah: number;
  poCount: number;
  avgHargaSatuan: number;
};

type AnalitikData = {
  range: { start: string; end: string };
  stageBacklog: StageBacklog[];
  stageAvgDuration: StageAvgDuration[];
  cycleTime: CycleTime;
  artikelPerformance: ArtikelPerformance[];
  totals: { poCreated: number; poCompleted: number; totalSetoranQty: number; totalUpah: number };
};

function rupiah(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function formatDurationHours(hours: number) {
  if (hours < 24) return `${Math.round(hours)} jam`;
  return `${Math.round((hours / 24) * 10) / 10} hari`;
}

export default function AnalitikDashboardClient({ namaLengkap }: { namaLengkap: string }) {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const thirtyDaysAgoStr = format(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [data, setData] = useState<AnalitikData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ start: startDate, end: endDate });
    const res = await fetch(`/api/analitik?${params.toString()}`);
    if (res.ok) {
      setData(await res.json());
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Gagal memuat data analitik");
      setData(null);
    }
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function applyPreset(days: number) {
    setEndDate(format(new Date(), "yyyy-MM-dd"));
    setStartDate(format(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  }

  const maxBacklogCount = Math.max(1, ...(data?.stageBacklog.map((s) => s.count) ?? [1]));
  const maxAvgHours = Math.max(1, ...(data?.stageAvgDuration.map((s) => s.avgHours) ?? [1]));
  const maxArtikelUpah = Math.max(1, ...(data?.artikelPerformance.map((a) => a.totalUpah) ?? [1]));

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar fallbackName={namaLengkap} />
      <main className="min-h-screen min-w-0 flex-1 bg-slate-100 pb-24 text-slate-900 md:pb-0">
        <div className="sticky top-14 z-20 flex flex-col gap-3 border-b border-dashed border-thread-300 bg-slate-100/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between md:top-0">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-denim-800">
              <BarChart3 className="h-4 w-4 shrink-0" /> Analitik Produksi
            </h1>
            <p className="truncate text-xs text-slate-500">
              Halo, {namaLengkap} - ringkasan lintas PO &amp; periode, otomatis dari data yang sudah ada
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => applyPreset(7)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-denim-300">
              7 Hari
            </button>
            <button type="button" onClick={() => applyPreset(30)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-denim-300">
              30 Hari
            </button>
            <button type="button" onClick={() => applyPreset(90)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-denim-300">
              90 Hari
            </button>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
            />
            <span className="text-xs text-slate-400">s/d</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={todayStr}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
            />
          </div>
        </div>

        <div className="space-y-4 px-3 py-4">
          {loading || !data ? (
            <p className="py-16 text-center text-sm text-slate-400">Memuat data analitik...</p>
          ) : (
            <>
              {/* ---------- Ringkasan ---------- */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <PackageCheck className="h-3.5 w-3.5" /> PO Dibuat
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-denim-900">{data.totals.poCreated}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <PackageCheck className="h-3.5 w-3.5 text-emerald-500" /> PO Selesai
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-emerald-700">{data.totals.poCompleted}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Clock className="h-3.5 w-3.5" /> Rata-rata Siklus PO
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-denim-900">
                    {data.cycleTime.completedCount ? `${data.cycleTime.avgDays}` : "-"}
                    <span className="text-sm font-medium text-slate-400"> hari</span>
                  </p>
                  {data.cycleTime.completedCount > 0 && (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      min {data.cycleTime.minDays}h - maks {data.cycleTime.maxDays}h
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <TrendingUp className="h-3.5 w-3.5" /> Total Upah Periode
                  </p>
                  <p className="mt-1 font-display text-xl font-bold text-thread-700">{rupiah(data.totals.totalUpah)}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{data.totals.totalSetoranQty.toLocaleString("id-ID")} pcs disetor</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* ---------- Backlog saat ini per tahapan ---------- */}
                <section className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-slate-800">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> PO Menumpuk di Tahapan (Sekarang)
                  </div>
                  <p className="mb-3 text-xs text-slate-400">Jumlah PO aktif per tahapan + usia PO paling lama di tahapan itu.</p>
                  <div className="space-y-3">
                    {data.stageBacklog.length ? (
                      data.stageBacklog.map((row) => (
                        <div key={row.stage} className="grid gap-1">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate font-medium text-slate-800">{row.stage}</span>
                            <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-500">
                              {row.count} PO
                              {row.oldestAgeHours > 48 && (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                  tertua {formatDurationHours(row.oldestAgeHours)}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-2 rounded bg-slate-100">
                            <div
                              className="h-2 rounded bg-amber-400"
                              style={{ width: `${Math.max(8, (row.count / maxBacklogCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">Tidak ada PO aktif saat ini.</p>
                    )}
                  </div>
                </section>

                {/* ---------- Rata-rata waktu per tahapan (historis) ---------- */}
                <section className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-slate-800">
                    <Clock className="h-4 w-4 text-denim-600" /> Rata-rata Waktu per Tahapan
                  </div>
                  <p className="mb-3 text-xs text-slate-400">Dihitung dari histori perpindahan PO yang selesai di periode ini.</p>
                  <div className="space-y-3">
                    {data.stageAvgDuration.length ? (
                      data.stageAvgDuration.map((row) => (
                        <div key={row.stage} className="grid gap-1">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate font-medium text-slate-800">{row.stage}</span>
                            <span className="shrink-0 text-xs font-semibold text-slate-500">
                              {formatDurationHours(row.avgHours)} <span className="text-slate-400">({row.samples}x)</span>
                            </span>
                          </div>
                          <div className="h-2 rounded bg-slate-100">
                            <div
                              className="h-2 rounded bg-denim-400"
                              style={{ width: `${Math.max(8, (row.avgHours / maxAvgHours) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">Belum ada perpindahan tahapan yang selesai di periode ini.</p>
                    )}
                  </div>
                </section>
              </div>

              {/* ---------- Performa per artikel ---------- */}
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-slate-800">
                  <ShirtIcon className="h-4 w-4 text-thread-500" /> Performa per Artikel
                </div>
                <p className="mb-3 text-xs text-slate-400">Dari setoran jahit pada periode terpilih, lintas semua PO.</p>
                <div className="space-y-2">
                  {data.artikelPerformance.length ? (
                    data.artikelPerformance.map((row) => (
                      <div key={row.nama_artikel} className="rounded-md border border-slate-100 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold text-slate-800">{row.nama_artikel}</p>
                          <p className="shrink-0 text-sm font-bold text-thread-700">{rupiah(row.totalUpah)}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {row.totalQty.toLocaleString("id-ID")} pcs - {row.poCount} PO - rata-rata harga satuan {rupiah(row.avgHargaSatuan)}
                        </p>
                        <div className="mt-1.5 h-1.5 rounded bg-slate-100">
                          <div
                            className="h-1.5 rounded bg-thread-400"
                            style={{ width: `${Math.max(4, (row.totalUpah / maxArtikelUpah) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-6 text-center text-sm text-slate-400">Belum ada setoran pada periode ini.</p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
