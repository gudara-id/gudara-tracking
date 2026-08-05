"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import InputSetoranJahitModal from "@/components/InputSetoranJahitModal";

type SetoranEntry = {
  id: number;
  tanggal_setoran: string;
  qty_disetor: number;
  harga_satuan_snapshot: number;
  total_upah: number;
  operator: { nama_operator: string };
  po: { nama_po: string; nama_artikel: string };
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
  const router = useRouter();
  const [entries, setEntries] = useState<SetoranEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/setoran?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`
    );
    if (res.ok) setEntries(await res.json());
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const totalUpahPeriode = entries.reduce((sum, e) => sum + e.total_upah, 0);
  const periodeLabel =
    startDate === endDate
      ? format(new Date(startDate), "dd MMMM yyyy")
      : `${format(new Date(startDate), "dd MMM yyyy")} - ${format(new Date(endDate), "dd MMM yyyy")}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard Setoran Jahit</h1>
          <p className="text-sm text-slate-500">
            Halo, {namaLengkap} - {periodeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => applyPreset("hari-ini")}>
            Hari Ini
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("minggu-ini")}>
            Minggu Ini (Sen–Sab)
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("minggu-lalu")}>
            Minggu Lalu
          </Button>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
          <span className="text-slate-400">s/d</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
          {!readOnly && <Button onClick={() => setModalOpen(true)}>+ Input Setoran Jahit</Button>}
          <Button
            variant="outline"
            onClick={() =>
              (window.location.href = `/api/setoran/export?start=${startDate}&end=${endDate}`)
            }
          >
            Export ke Excel
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            Keluar
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="text-slate-500">Total Upah Periode Ini: </span>
        <span className="font-semibold text-slate-900">Rp {totalUpahPeriode.toLocaleString("id-ID")}</span>
        <span className="mx-2 text-slate-300">|</span>
        <span className="text-slate-500">Jumlah Setoran: </span>
        <span className="font-semibold text-slate-900">{entries.length}</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Operator Jahit</TableHead>
            <TableHead>Nama PO</TableHead>
            <TableHead>Tanggal Setoran</TableHead>
            <TableHead>Artikel</TableHead>
            <TableHead>Harga Satuan</TableHead>
            <TableHead>QTY</TableHead>
            <TableHead>Totalan (Total Upah)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-slate-400">
                Memuat data...
              </TableCell>
            </TableRow>
          ) : entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-slate-400">
                Belum ada setoran pada periode ini
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.operator.nama_operator}</TableCell>
                <TableCell>{entry.po.nama_po}</TableCell>
                <TableCell>{format(new Date(entry.tanggal_setoran), "dd/MM/yyyy HH:mm")}</TableCell>
                <TableCell>{entry.po.nama_artikel}</TableCell>
                <TableCell>Rp {entry.harga_satuan_snapshot.toLocaleString("id-ID")}</TableCell>
                <TableCell>{entry.qty_disetor}</TableCell>
                <TableCell className="font-semibold">Rp {entry.total_upah.toLocaleString("id-ID")}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {!readOnly && <InputSetoranJahitModal open={modalOpen} onOpenChange={setModalOpen} onSaved={fetchEntries} />}
    </main>
  );
}