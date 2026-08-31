"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  Download,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Sidebar from "@/components/Sidebar";

type PeriodSummary = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  status: "draft" | "paid";
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
  status: "draft" | "paid";
  created_by_nama: string | null;
  paid_by_nama: string | null;
  paid_at: string | null;
  createdAt: string;
  operators: OperatorRekap[];
  grandTotal: {
    total_qty: number;
    base_upah: number;
    bonus_total: number;
    potongan_total: number;
    total_gaji: number;
  };
};

type OperatorOption = { id: number; nama_operator: string };

function rupiah(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

export default function PayrollDashboardClient({ namaLengkap }: { namaLengkap: string }) {
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PeriodDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newStart, setNewStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newEnd, setNewEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [creating, setCreating] = useState(false);

  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [adjustmentTarget, setAdjustmentTarget] = useState<{ operator_id: number; nama_operator: string } | null>(null);
  const [adjType, setAdjType] = useState<"bonus" | "potongan">("bonus");
  const [adjLabel, setAdjLabel] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const fetchPeriods = useCallback(async () => {
    setLoadingPeriods(true);
    const res = await fetch("/api/payroll/periods");
    if (res.ok) {
      const data: PeriodSummary[] = await res.json();
      setPeriods(data);
      // Kalau belum ada periode yang dipilih, otomatis pilih yang paling baru
      // supaya panel kanan tidak kosong percuma.
      setSelectedId((current) => current ?? data[0]?.id ?? null);
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Gagal memuat periode payroll");
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
      toast.error(body?.error || "Gagal memuat detail periode");
      setDetail(null);
    }
    setLoadingDetail(false);
  }, []);

  useEffect(() => {
    fetchPeriods();
    fetch("/api/operator")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setOperators(data))
      .catch(() => setOperators([]));
  }, [fetchPeriods]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
    else setDetail(null);
  }, [selectedId, fetchDetail]);

  async function createPeriod() {
    if (!newLabel.trim()) {
      toast.error("Nama periode wajib diisi");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/payroll/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim(), start_date: newStart, end_date: newEnd }),
    });
    setCreating(false);
    if (res.ok) {
      const created = await res.json();
      toast.success("Periode payroll dibuat");
      setCreateOpen(false);
      setNewLabel("");
      await fetchPeriods();
      setSelectedId(created.id);
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Gagal membuat periode");
    }
  }

  async function togglePaid(period: PeriodDetail) {
    const nextStatus = period.status === "paid" ? "draft" : "paid";
    const res = await fetch(`/api/payroll/periods/${period.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      toast.success(nextStatus === "paid" ? "Periode ditandai sudah dibayar" : "Periode dikembalikan ke draft");
      await fetchPeriods();
      await fetchDetail(period.id);
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Gagal memperbarui status periode");
    }
  }

  async function deletePeriod(period: { id: number; label: string }) {
    if (!confirm(`Hapus periode "${period.label}"? Semua adjustment di dalamnya ikut terhapus.`)) return;
    const res = await fetch(`/api/payroll/periods/${period.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Periode dihapus");
      setSelectedId(null);
      await fetchPeriods();
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Gagal menghapus periode");
    }
  }

  async function saveAdjustment() {
    if (!detail || !adjustmentTarget) return;
    const amountNum = Number(adjAmount);
    if (!adjLabel.trim()) {
      toast.error("Keterangan wajib diisi");
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Nominal harus lebih dari 0");
      return;
    }
    setSavingAdjustment(true);
    const res = await fetch("/api/payroll/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_id: detail.id,
        operator_id: adjustmentTarget.operator_id,
        type: adjType,
        label: adjLabel.trim(),
        amount: amountNum,
      }),
    });
    setSavingAdjustment(false);
    if (res.ok) {
      toast.success(adjType === "bonus" ? "Bonus ditambahkan" : "Potongan ditambahkan");
      setAdjustmentTarget(null);
      setAdjLabel("");
      setAdjAmount("");
      setAdjType("bonus");
      await fetchDetail(detail.id);
      await fetchPeriods();
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Gagal menyimpan adjustment");
    }
  }

  async function removeAdjustment(adjustmentId: number) {
    if (!detail) return;
    const res = await fetch(`/api/payroll/adjustments/${adjustmentId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Adjustment dihapus");
      await fetchDetail(detail.id);
      await fetchPeriods();
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Gagal menghapus adjustment");
    }
  }

  function exportExcel() {
    if (!detail) return;
    window.open(`/api/payroll/periods/${detail.id}/export`, "_blank");
  }

  function buildSlipHtml(rows: OperatorRekap[], period: PeriodDetail) {
    const periodeLabel = `${format(new Date(period.start_date), "dd MMM yyyy")} - ${format(new Date(period.end_date), "dd MMM yyyy")}`;
    const slips = rows
      .map((op) => {
        const adjustmentRows = op.adjustments
          .map(
            (adj) =>
              `<tr><td>${escapeHtml(adj.label)} ${adj.type === "bonus" ? "(+)" : "(-)"}</td><td style="text-align:right">${
                adj.type === "bonus" ? "" : "-"
              }Rp ${Math.round(adj.amount).toLocaleString("id-ID")}</td></tr>`
          )
          .join("");
        return `
          <div class="slip">
            <h2>${escapeHtml(period.label)}</h2>
            <p class="periode">${periodeLabel}</p>
            <p class="nama">${escapeHtml(op.nama_operator)}</p>
            <table>
              <tr><td>Upah Borongan (${op.total_qty} pcs)</td><td style="text-align:right">Rp ${Math.round(op.base_upah).toLocaleString("id-ID")}</td></tr>
              ${adjustmentRows}
              <tr class="total"><td>Total Diterima</td><td style="text-align:right">Rp ${Math.round(op.total_gaji).toLocaleString("id-ID")}</td></tr>
            </table>
          </div>`;
      })
      .join("");

    return `<!DOCTYPE html><html><head><title>Slip Gaji - ${escapeHtml(period.label)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
        .slip { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
        h2 { margin: 0 0 2px; font-size: 16px; }
        .periode { margin: 0 0 10px; color: #64748b; font-size: 12px; }
        .nama { font-weight: bold; font-size: 14px; margin: 0 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        td { padding: 4px 0; }
        tr.total td { border-top: 2px solid #0f172a; font-weight: bold; padding-top: 8px; }
      </style></head><body>${slips}</body></html>`;
  }

  function printSlips(rows: OperatorRekap[]) {
    if (!detail) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildSlipHtml(rows, detail));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar fallbackName={namaLengkap} />
      <main className="min-h-screen min-w-0 flex-1 bg-slate-100 pb-24 text-slate-900 md:pb-0">
        <div className="sticky top-14 z-20 flex flex-col gap-3 border-b border-dashed border-thread-300 bg-slate-100/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between md:top-0">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-denim-800">
              <Wallet className="h-4 w-4 shrink-0" /> Payroll
            </h1>
            <p className="truncate text-xs text-slate-500">Halo, {namaLengkap} - rekap upah operator jahit per periode</p>
          </div>
          <Button className="shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Periode Baru
          </Button>
        </div>

        <section className="grid gap-4 px-3 py-4 lg:grid-cols-[300px_1fr]">
          {/* ---------- Daftar periode ---------- */}
          <div className="min-w-0 rounded-md bg-white p-3 shadow-sm ring-1 ring-black/5 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
            <p className="mb-2 px-1 text-xs font-semibold uppercase text-slate-500">Periode Payroll</p>
            {loadingPeriods ? (
              <p className="px-1 py-4 text-center text-sm text-slate-400">Memuat...</p>
            ) : periods.length === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-slate-400">Belum ada periode. Buat periode baru dulu.</p>
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
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          period.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {period.status === "paid" ? "Dibayar" : "Draft"}
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

          {/* ---------- Detail rekap periode terpilih ---------- */}
          <div className="min-w-0 rounded-md bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
            {!selectedId ? (
              <p className="py-10 text-center text-sm text-slate-400">Pilih atau buat periode payroll untuk melihat rekap.</p>
            ) : loadingDetail || !detail ? (
              <p className="py-10 text-center text-sm text-slate-400">Memuat rekap...</p>
            ) : (
              <>
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-bold text-slate-900">{detail.label}</h2>
                    <p className="text-sm text-slate-500">
                      {format(new Date(detail.start_date), "dd MMM yyyy")} - {format(new Date(detail.end_date), "dd MMM yyyy")}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {detail.status === "paid"
                        ? `Dibayar oleh ${detail.paid_by_nama ?? "-"} pada ${
                            detail.paid_at ? format(new Date(detail.paid_at), "dd/MM/yyyy HH:mm") : "-"
                          }`
                        : `Dibuat oleh ${detail.created_by_nama ?? "-"}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 self-start rounded-full px-3 py-1 text-xs font-semibold ${
                      detail.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {detail.status === "paid" ? "Sudah Dibayar" : "Draft"}
                  </span>
                </div>

                <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
                  <Button variant="outline" className="shrink-0" onClick={() => togglePaid(detail)}>
                    {detail.status === "paid" ? (
                      <>
                        <RotateCcw className="mr-1 h-4 w-4" /> Kembalikan ke Draft
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Tandai Sudah Dibayar
                      </>
                    )}
                  </Button>
                  <Button variant="outline" className="shrink-0" onClick={exportExcel}>
                    <Download className="mr-1 h-4 w-4" /> Export Excel
                  </Button>
                  <Button variant="outline" className="shrink-0" onClick={() => printSlips(detail.operators)}>
                    <Printer className="mr-1 h-4 w-4" /> Cetak Semua Slip
                  </Button>
                  {detail.status === "draft" && (
                    <Button
                      variant="outline"
                      className="shrink-0 text-red-600 hover:text-red-700"
                      onClick={() => deletePeriod(detail)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Hapus Periode
                    </Button>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  {detail.operators.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">
                      Belum ada setoran atau adjustment operator di rentang tanggal periode ini.
                    </p>
                  ) : (
                    detail.operators.map((op) => (
                      <div key={op.operator_id} className="rounded-md border border-slate-200 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{op.nama_operator}</p>
                            <p className="text-xs text-slate-400">{op.total_qty} pcs disetor</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-denim-700">{rupiah(op.total_gaji)}</p>
                            <p className="text-[11px] text-slate-400">borongan {rupiah(op.base_upah)}</p>
                          </div>
                        </div>

                        {op.adjustments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {op.adjustments.map((adj) => (
                              <span
                                key={adj.id}
                                className={`flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1.5 text-[11px] font-medium ${
                                  adj.type === "bonus" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                }`}
                              >
                                {adj.type === "bonus" ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                <span className="max-w-[160px] truncate">{adj.label}</span>
                                <span>{rupiah(adj.amount)}</span>
                                <button
                                  type="button"
                                  onClick={() => removeAdjustment(adj.id)}
                                  className="rounded-full p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100"
                                  title="Hapus"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAdjustmentTarget({ operator_id: op.operator_id, nama_operator: op.nama_operator });
                              setAdjType("bonus");
                            }}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" /> Bonus
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAdjustmentTarget({ operator_id: op.operator_id, nama_operator: op.nama_operator });
                              setAdjType("potongan");
                            }}
                          >
                            <Minus className="mr-1 h-3.5 w-3.5" /> Potongan
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => printSlips([op])}>
                            <Printer className="mr-1 h-3.5 w-3.5" /> Cetak Slip
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {detail.operators.length > 0 && (
                  <div className="mt-4 flex items-center justify-between rounded-md bg-denim-900 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Banknote className="h-4 w-4 text-thread-300" /> Total Gaji Periode
                    </div>
                    <p className="text-lg font-bold text-thread-300">{rupiah(detail.grandTotal.total_gaji)}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {/* ---------- Modal buat periode baru ---------- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Periode Payroll Baru</DialogTitle>
            <DialogDescription>Rekap upah dihitung otomatis dari setoran di rentang tanggal ini.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Nama Periode</label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Contoh: 1-15 Agustus 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Tanggal Mulai</label>
                <input
                  type="date"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Tanggal Akhir</label>
                <input
                  type="date"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button onClick={createPeriod} disabled={creating}>
              {creating ? "Menyimpan..." : "Buat Periode"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Modal tambah bonus/potongan ---------- */}
      <Dialog open={!!adjustmentTarget} onOpenChange={(open) => !open && setAdjustmentTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="break-words">
              {adjType === "bonus" ? "Tambah Bonus" : "Tambah Potongan"} - {adjustmentTarget?.nama_operator}
            </DialogTitle>
            <DialogDescription>
              {adjType === "bonus"
                ? "Ditambahkan ke total gaji operator ini."
                : "Dikurangkan dari total gaji operator ini (mis. kasbon, potongan absen)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={adjType === "bonus" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setAdjType("bonus")}
              >
                <Plus className="mr-1 h-4 w-4" /> Bonus
              </Button>
              <Button
                type="button"
                variant={adjType === "potongan" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setAdjType("potongan")}
              >
                <Minus className="mr-1 h-4 w-4" /> Potongan
              </Button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Keterangan</label>
              <Input
                value={adjLabel}
                onChange={(e) => setAdjLabel(e.target.value)}
                placeholder={adjType === "bonus" ? "Contoh: Bonus lembur" : "Contoh: Kasbon"}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Nominal (Rp)</label>
              <Input
                type="number"
                min={1}
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdjustmentTarget(null)}>
              Batal
            </Button>
            <Button onClick={saveAdjustment} disabled={savingAdjustment}>
              {savingAdjustment ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
