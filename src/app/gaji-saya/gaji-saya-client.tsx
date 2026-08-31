"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Banknote, Minus, Plus, Printer, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";

type PeriodSummary = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  status: "paid";
  paid_at: string | null;
  createdAt: string;
  base_upah: number;
  adjustments_total: number;
  total_gaji: number;
};

type Adjustment = {
  id: number;
  type: "bonus" | "potongan";
  label: string;
  amount: number;
  created_by_nama: string;
  createdAt: string;
};

type OperatorRekap = {
  operator_id: number;
  nama_operator: string;
  total_qty: number;
  base_upah: number;
  adjustments: Adjustment[];
  bonus_total: number;
  potongan_total: number;
  total_gaji: number;
};

type PeriodDetail = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  status: "paid";
  paid_by_nama: string | null;
  paid_at: string | null;
  operators: OperatorRekap[];
  grandTotal: {
    total_qty: number;
    base_upah: number;
    bonus_total: number;
    potongan_total: number;
    total_gaji: number;
  };
};

function rupiah(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

export default function GajiSayaClient({ namaLengkap }: { namaLengkap: string }) {
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PeriodDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchPeriods = useCallback(async () => {
    setLoadingPeriods(true);
    const res = await fetch("/api/payroll/periods");
    if (res.ok) {
      const data: PeriodSummary[] = await res.json();
      setPeriods(data);
      setSelectedId((current) => current ?? data[0]?.id ?? null);
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Gagal memuat riwayat gaji");
    }
    setLoadingPeriods(false);
  }, []);

  const fetchDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    const res = await fetch(`/api/payroll/periods/${id}`);
    if (res.ok) {
      setDetail(await res.json());
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Gagal memuat detail slip gaji");
      setDetail(null);
    }
    setLoadingDetail(false);
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
    else setDetail(null);
  }, [selectedId, fetchDetail]);

  function printSlip() {
    if (!detail || !detail.operators.length) return;
    const op = detail.operators[0];
    const periodeLabel = `${format(new Date(detail.start_date), "dd MMM yyyy")} - ${format(new Date(detail.end_date), "dd MMM yyyy")}`;
    const adjustmentRows = op.adjustments
      .map(
        (adj) =>
          `<tr><td>${escapeHtml(adj.label)} ${adj.type === "bonus" ? "(+)" : "(-)"}</td><td style="text-align:right">${
            adj.type === "bonus" ? "" : "-"
          }Rp ${Math.round(adj.amount).toLocaleString("id-ID")}</td></tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><title>Slip Gaji - ${escapeHtml(detail.label)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
        .slip { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; max-width: 420px; }
        h2 { margin: 0 0 2px; font-size: 16px; }
        .periode { margin: 0 0 10px; color: #64748b; font-size: 12px; }
        .nama { font-weight: bold; font-size: 14px; margin: 0 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        td { padding: 4px 0; }
        tr.total td { border-top: 2px solid #0f172a; font-weight: bold; padding-top: 8px; }
      </style></head><body>
        <div class="slip">
          <h2>${escapeHtml(detail.label)}</h2>
          <p class="periode">${periodeLabel}</p>
          <p class="nama">${escapeHtml(op.nama_operator)}</p>
          <table>
            <tr><td>Upah Borongan (${op.total_qty} pcs)</td><td style="text-align:right">Rp ${Math.round(op.base_upah).toLocaleString("id-ID")}</td></tr>
            ${adjustmentRows}
            <tr class="total"><td>Total Diterima</td><td style="text-align:right">Rp ${Math.round(op.total_gaji).toLocaleString("id-ID")}</td></tr>
          </table>
        </div>
      </body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  const own = detail?.operators[0] ?? null;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar fallbackName={namaLengkap} />
      <main className="min-h-screen min-w-0 flex-1 bg-slate-100 pb-24 text-slate-900 md:pb-0">
        <div className="sticky top-14 z-20 border-b border-dashed border-thread-300 bg-slate-100/95 px-4 py-3 backdrop-blur md:top-0">
          <h1 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-denim-800">
            <Wallet className="h-4 w-4 shrink-0" /> Gaji Saya
          </h1>
          <p className="truncate text-xs text-slate-500">Halo, {namaLengkap} - riwayat slip gaji yang sudah dibayar</p>
        </div>

        <section className="grid gap-4 px-3 py-4 lg:grid-cols-[300px_1fr]">
          {/* ---------- Daftar periode ---------- */}
          <div className="min-w-0 rounded-md bg-white p-3 shadow-sm ring-1 ring-black/5 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
            <p className="mb-2 px-1 text-xs font-semibold uppercase text-slate-500">Riwayat Periode</p>
            {loadingPeriods ? (
              <p className="px-1 py-4 text-center text-sm text-slate-400">Memuat...</p>
            ) : periods.length === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-slate-400">
                Belum ada slip gaji yang sudah dibayar atas nama Anda.
              </p>
            ) : (
              <div className="space-y-1.5">
                {periods.map((period) => (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => setSelectedId(period.id)}
                    className={`w-full min-w-0 rounded-md border px-3 py-2.5 text-left transition-colors ${
                      selectedId === period.id
                        ? "border-denim-600 bg-denim-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-800">{period.label}</p>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Dibayar
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-slate-400">
                      {format(new Date(period.start_date), "dd MMM")} - {format(new Date(period.end_date), "dd MMM yyyy")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-denim-700">{rupiah(period.total_gaji)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ---------- Detail slip periode terpilih ---------- */}
          <div className="min-w-0 rounded-md bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
            {!selectedId ? (
              <p className="py-10 text-center text-sm text-slate-400">Pilih periode untuk melihat slip gaji.</p>
            ) : loadingDetail || !detail || !own ? (
              <p className="py-10 text-center text-sm text-slate-400">Memuat slip...</p>
            ) : (
              <>
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-bold text-slate-900">{detail.label}</h2>
                    <p className="text-sm text-slate-500">
                      {format(new Date(detail.start_date), "dd MMM yyyy")} - {format(new Date(detail.end_date), "dd MMM yyyy")}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Dibayar oleh {detail.paid_by_nama ?? "-"} pada{" "}
                      {detail.paid_at ? format(new Date(detail.paid_at), "dd/MM/yyyy HH:mm") : "-"}
                    </p>
                  </div>
                  <span className="shrink-0 self-start rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Sudah Dibayar
                  </span>
                </div>

                <div className="mt-4">
                  <Button variant="outline" onClick={printSlip}>
                    <Printer className="mr-1 h-4 w-4" /> Cetak Slip Gaji
                  </Button>
                </div>

                <div className="mt-4 rounded-md border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{own.nama_operator}</p>
                      <p className="text-xs text-slate-400">{own.total_qty} pcs disetor</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-denim-700">{rupiah(own.total_gaji)}</p>
                      <p className="text-[11px] text-slate-400">borongan {rupiah(own.base_upah)}</p>
                    </div>
                  </div>

                  {own.adjustments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {own.adjustments.map((adj) => (
                        <span
                          key={adj.id}
                          className={`flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2.5 text-[11px] font-medium ${
                            adj.type === "bonus" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                          }`}
                        >
                          {adj.type === "bonus" ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          <span className="max-w-[160px] truncate">{adj.label}</span>
                          <span>{rupiah(adj.amount)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-md bg-denim-900 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Banknote className="h-4 w-4 text-thread-300" /> Total Diterima
                  </div>
                  <p className="text-lg font-bold text-thread-300">{rupiah(detail.grandTotal.total_gaji)}</p>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
