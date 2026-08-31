"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { BarChart3, FileText, Printer, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import InputSetoranJahitModal from "@/components/InputSetoranJahitModal";
import Sidebar from "@/components/Sidebar";

type SetoranEntry = {
  id: number;
  tanggal_setoran: string;
  qty_disetor: number;
  qty_reject: number;
  catatan_reject: string | null;
  harga_satuan_snapshot: number;
  total_upah: number;
  foto_url: string | null;
  operator: { nama_operator: string };
  po: { nama_po: string; nama_artikel: string };
};

type OperatorOption = {
  id: number;
  nama_operator: string;
};

// Minggu kerja: Senin s/d Sabtu (Sabtu = hari pembayaran).
function getWeekRange(reference: Date, weeksAgo = 0) {
  const day = reference.getDay(); // 0 = Minggu, 1 = Senin, ... 6 = Sabtu
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(reference);
  monday.setDate(reference.getDate() + diffToMonday - weeksAgo * 7);
  monday.setHours(0, 0, 0, 0);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return { start: format(monday, "yyyy-MM-dd"), end: format(saturday, "yyyy-MM-dd") };
}

export default function JahitDashboardClient({
  namaLengkap,
  readOnly = false,
}: {
  namaLengkap: string;
  readOnly?: boolean;
}) {
  const [entries, setEntries] = useState<SetoranEntry[]>([]);
  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [operatorId, setOperatorId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ start: startDate, end: endDate });
    if (operatorId) params.set("operator_id", operatorId);
    const res = await fetch(`/api/setoran?${params.toString()}`);
    if (res.ok) setEntries(await res.json());
    setLoading(false);
  }, [startDate, endDate, operatorId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    if (readOnly) return;
    fetch("/api/operator")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setOperators(data))
      .catch(() => setOperators([]));
  }, [readOnly]);

  function applyPreset(preset: "hari-ini" | "minggu-ini" | "minggu-lalu") {
    const now = new Date();
    if (preset === "hari-ini") {
      const t = format(now, "yyyy-MM-dd");
      setStartDate(t);
      setEndDate(t);
    } else if (preset === "minggu-ini") {
      const { start, end } = getWeekRange(now, 0);
      setStartDate(start);
      setEndDate(end);
    } else {
      const { start, end } = getWeekRange(now, 1);
      setStartDate(start);
      setEndDate(end);
    }
  }

  const totalQtyPeriode = entries.reduce((sum, e) => sum + e.qty_disetor, 0);
  const totalUpahPeriode = entries.reduce((sum, e) => sum + e.total_upah, 0);
  const totalRejectPeriode = entries.reduce((sum, e) => sum + (e.qty_reject ?? 0), 0);
  const ranking = useMemo(() => {
    return Object.values(
      entries.reduce<Record<string, { nama_operator: string; qty: number; upah: number; entries: number; reject: number }>>(
        (groups, entry) => {
          const key = entry.operator.nama_operator;
          groups[key] = groups[key] ?? { nama_operator: key, qty: 0, upah: 0, entries: 0, reject: 0 };
          groups[key].qty += entry.qty_disetor;
          groups[key].upah += entry.total_upah;
          groups[key].entries += 1;
          groups[key].reject += entry.qty_reject ?? 0;
          return groups;
        },
        {}
      )
    ).sort((a, b) => b.qty - a.qty || b.upah - a.upah);
  }, [entries]);
  const periodeLabel =
    startDate === endDate
      ? format(new Date(startDate), "dd MMMM yyyy")
      : `${format(new Date(startDate), "dd MMM yyyy")} - ${format(new Date(endDate), "dd MMM yyyy")}`;

  function printPayrollSlip(operatorName?: string) {
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
    const rows = operatorName ? entries.filter((entry) => entry.operator.nama_operator === operatorName) : entries;
    const title = operatorName ? `Slip Upah - ${operatorName}` : "Rekap Upah Semua Operator";
    const totalQty = rows.reduce((sum, entry) => sum + entry.qty_disetor, 0);
    const totalUpah = rows.reduce((sum, entry) => sum + entry.total_upah, 0);
    const tableRows = rows
      .map(
        (entry) => `
          <tr>
            <td>${format(new Date(entry.tanggal_setoran), "dd/MM/yyyy HH:mm")}</td>
            <td>${escapeHtml(entry.operator.nama_operator)}</td>
            <td>${escapeHtml(entry.po.nama_po)}</td>
            <td>${escapeHtml(entry.po.nama_artikel)}</td>
            <td style="text-align:right">${entry.qty_disetor}</td>
            <td style="text-align:right">${entry.qty_reject || "-"}</td>
            <td style="text-align:right">Rp ${entry.harga_satuan_snapshot.toLocaleString("id-ID")}</td>
            <td style="text-align:right">Rp ${entry.total_upah.toLocaleString("id-ID")}</td>
          </tr>`
      )
      .join("");

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            p { margin: 0 0 16px; color: #475569; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; }
            th { background: #f1f5f9; text-align: left; }
            tfoot td { font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <p>Periode: ${escapeHtml(periodeLabel)}</p>
          <table>
            <thead>
              <tr><th>Tanggal</th><th>Operator</th><th>PO</th><th>Artikel</th><th>QTY</th><th>Reject</th><th>Harga</th><th>Total Upah</th></tr>
            </thead>
            <tbody>${tableRows || `<tr><td colspan="8">Tidak ada data</td></tr>`}</tbody>
            <tfoot><tr><td colspan="4">TOTAL</td><td style="text-align:right">${totalQty}</td><td></td><td></td><td style="text-align:right">Rp ${totalUpah.toLocaleString("id-ID")}</td></tr></tfoot>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar fallbackName={namaLengkap} />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-24 pt-4 md:px-4 md:pb-8 md:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-denim-900">Dashboard Setoran Jahit</h1>
          <p className="text-sm text-slate-500">
            Halo, {namaLengkap} - {periodeLabel}
          </p>
        </div>

        {/* Desktop / tablet: single compact toolbar */}
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
            <Button variant="ghost" size="sm" onClick={() => applyPreset("hari-ini")}>
              Hari Ini
            </Button>
            <Button variant="ghost" size="sm" onClick={() => applyPreset("minggu-ini")}>
              Minggu Ini (Sen–Sab)
            </Button>
            <Button variant="ghost" size="sm" onClick={() => applyPreset("minggu-lalu")}>
              Minggu Lalu
            </Button>
          </div>
          {!readOnly && (
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-denim-200"
            >
              <option value="">Semua Operator</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.nama_operator}
                </option>
              ))}
            </select>
          )}
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
          <span className="text-slate-400">s/d</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
          <span className="mx-1 h-6 w-px bg-slate-200" />
          {!readOnly && <Button onClick={() => setModalOpen(true)}>+ Input Setoran Jahit</Button>}
          <Button
            variant="outline"
            onClick={() =>
              (window.location.href = `/api/setoran/export?start=${startDate}&end=${endDate}${
                operatorId ? `&operator_id=${operatorId}` : ""
              }`)
            }
          >
            Export ke Excel
          </Button>
          <Button variant="outline" onClick={() => printPayrollSlip()}>
            <Printer className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Mobile: primary action + scrollable chip filters */}
      {!readOnly && (
        <Button onClick={() => setModalOpen(true)} className="mb-4 w-full md:hidden">
          + Input Setoran Jahit
        </Button>
      )}

      <div className="mb-4 space-y-3 md:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => applyPreset("hari-ini")}>
            Hari Ini
          </Button>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => applyPreset("minggu-ini")}>
            Minggu Ini (Sen–Sab)
          </Button>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => applyPreset("minggu-lalu")}>
            Minggu Lalu
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {!readOnly && (
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              className="col-span-2 h-11 rounded-md border border-slate-300 bg-white px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-denim-200"
            >
              <option value="">Semua Operator</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.nama_operator}
                </option>
              ))}
            </select>
          )}
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() =>
              (window.location.href = `/api/setoran/export?start=${startDate}&end=${endDate}${
                operatorId ? `&operator_id=${operatorId}` : ""
              }`)
            }
          >
            Export ke Excel
          </Button>
          <Button variant="outline" className="shrink-0" onClick={() => printPayrollSlip()}>
            <Printer className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border-l-4 border-thread-400 bg-white px-4 py-3 text-sm shadow-sm transition-shadow md:hover:shadow-md">
          <span className="text-slate-500">Total Upah</span>
          <p className="mt-1 font-display text-xl font-bold text-thread-700">Rp {totalUpahPeriode.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded-lg border-l-4 border-denim-500 bg-white px-4 py-3 text-sm shadow-sm transition-shadow md:hover:shadow-md">
          <span className="text-slate-500">Total QTY</span>
          <p className="mt-1 font-display text-xl font-bold text-denim-800">{totalQtyPeriode}</p>
        </div>
        <div className="rounded-lg border-l-4 border-emerald-500 bg-white px-4 py-3 text-sm shadow-sm transition-shadow md:hover:shadow-md">
          <span className="text-slate-500">Jumlah Setoran</span>
          <p className="mt-1 font-display text-xl font-bold text-emerald-700">{entries.length}</p>
        </div>
        <div className="rounded-lg border-l-4 border-red-400 bg-white px-4 py-3 text-sm shadow-sm transition-shadow md:hover:shadow-md">
          <span className="text-slate-500">Total Reject/Cacat</span>
          <p className="mt-1 font-display text-xl font-bold text-red-600">{totalRejectPeriode} pcs</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-slate-800">
            <Trophy className="h-4 w-4 text-thread-500" /> Ranking Performa Operator
          </div>
          <div className="space-y-3">
            {ranking.length ? (
              ranking.slice(0, 8).map((row, index) => {
                const maxQty = Math.max(...ranking.map((item) => item.qty), 1);
                return (
                  <div key={row.nama_operator} className="grid gap-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-800">{index + 1}. {row.nama_operator}</span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        {row.qty} pcs
                        {row.reject > 0 && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                            {row.reject} reject
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 rounded bg-slate-100">
                      <div className="h-2 rounded bg-thread-400" style={{ width: `${Math.max(8, (row.qty / maxQty) * 100)}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400">Belum ada data ranking pada periode ini.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-slate-800">
            <BarChart3 className="h-4 w-4 text-denim-600" /> Rekap Upah Operator
          </div>
          <div className="space-y-2">
            {ranking.length ? (
              ranking.map((row) => (
                <div key={row.nama_operator} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{row.nama_operator}</p>
                    <p className="text-xs text-slate-500">{row.entries} setoran - {row.qty} pcs</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">Rp {row.upah.toLocaleString("id-ID")}</p>
                    <button type="button" onClick={() => printPayrollSlip(row.nama_operator)} className="inline-flex items-center gap-1 text-xs font-medium text-denim-700 hover:text-denim-900">
                      <FileText className="h-3 w-3" /> Slip
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Belum ada rekap upah pada periode ini.</p>
            )}
          </div>
        </section>
      </div>

      {/* Mobile: card list — easier to scan and tap than a cramped 7-column table */}
      <div className="space-y-2 md:hidden">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Memuat data...</p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Belum ada setoran pada periode ini</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{entry.operator.nama_operator}</p>
                  <p className="truncate text-xs text-slate-500">
                    {entry.po.nama_po} &middot; {entry.po.nama_artikel}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                  {format(new Date(entry.tanggal_setoran), "dd/MM HH:mm")}
                </span>
              </div>
              {entry.qty_reject > 0 && (
                <div className="mb-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                  <span className="font-semibold">{entry.qty_reject} pcs reject</span>
                  {entry.catatan_reject ? ` — ${entry.catatan_reject}` : ""}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2 text-sm">
                <span className="text-slate-500">
                  {entry.qty_disetor} pcs &times; Rp {entry.harga_satuan_snapshot.toLocaleString("id-ID")}
                </span>
                <div className="flex items-center gap-2">
                  {entry.foto_url && (
                    <button
                      type="button"
                      onClick={() => setFotoPreview(entry.foto_url)}
                      className="tap-shrink shrink-0 overflow-hidden rounded-md border border-slate-200"
                      aria-label="Lihat foto hasil jahit"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entry.foto_url} alt="Foto hasil jahit" className="h-8 w-8 object-cover" />
                    </button>
                  )}
                  <span className="font-semibold text-thread-700">Rp {entry.total_upah.toLocaleString("id-ID")}</span>
                </div>
              </div>
            </div>
          ))
        )}
        {entries.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-denim-200 bg-denim-50/50 px-4 py-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-denim-500">Total ({totalQtyPeriode} pcs)</p>
            </div>
            <p className="font-display text-base font-bold text-denim-900">Rp {totalUpahPeriode.toLocaleString("id-ID")}</p>
          </div>
        )}
      </div>

      {/* Desktop / tablet: full table */}
      <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Operator Jahit</TableHead>
            <TableHead>Nama PO</TableHead>
            <TableHead>Tanggal Setoran</TableHead>
            <TableHead>Artikel</TableHead>
            <TableHead className="text-right">Harga Satuan</TableHead>
            <TableHead className="text-right">QTY</TableHead>
            <TableHead className="text-right">Reject</TableHead>
            <TableHead className="text-right">Totalan (Total Upah)</TableHead>
            <TableHead className="text-center">Foto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-slate-400">
                Memuat data...
              </TableCell>
            </TableRow>
          ) : entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-slate-400">
                Belum ada setoran pada periode ini
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.operator.nama_operator}</TableCell>
                <TableCell>{entry.po.nama_po}</TableCell>
                <TableCell className="text-slate-500">{format(new Date(entry.tanggal_setoran), "dd/MM/yyyy HH:mm")}</TableCell>
                <TableCell>{entry.po.nama_artikel}</TableCell>
                <TableCell className="text-right tabular-nums">Rp {entry.harga_satuan_snapshot.toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.qty_disetor}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {entry.qty_reject > 0 ? (
                    <span
                      className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                      title={entry.catatan_reject ?? undefined}
                    >
                      {entry.qty_reject} pcs
                    </span>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-thread-700">Rp {entry.total_upah.toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-center">
                  {entry.foto_url ? (
                    <button
                      type="button"
                      onClick={() => setFotoPreview(entry.foto_url)}
                      className="inline-flex overflow-hidden rounded-md border border-slate-200 align-middle"
                      aria-label="Lihat foto hasil jahit"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entry.foto_url} alt="Foto hasil jahit" className="h-8 w-8 object-cover" />
                    </button>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {entries.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} className="text-right">
                TOTAL
              </TableCell>
              <TableCell className="text-right tabular-nums">{totalQtyPeriode}</TableCell>
              <TableCell className="text-right tabular-nums text-red-600">{totalRejectPeriode}</TableCell>
              <TableCell className="text-right tabular-nums">Rp {totalUpahPeriode.toLocaleString("id-ID")}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
      </div>

      {!readOnly && <InputSetoranJahitModal open={modalOpen} onOpenChange={setModalOpen} onSaved={fetchEntries} />}

      {fotoPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6"
          onClick={() => setFotoPreview(null)}
        >
          <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setFotoPreview(null)}
              className="absolute -right-3 -top-3 rounded-full bg-white p-1.5 text-slate-700 shadow-lg"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotoPreview}
              alt="Foto hasil jahit"
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
