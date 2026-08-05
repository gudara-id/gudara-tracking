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
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/setoran?date=${encodeURIComponent(selectedDate)}`);
    if (res.ok) setEntries(await res.json());
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const totalUpahTanggalIni = entries.reduce((sum, e) => sum + e.total_upah, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard Setoran Jahit</h1>
          <p className="text-sm text-slate-500">
            Halo, {namaLengkap} - {format(new Date(selectedDate), "dd MMMM yyyy")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />
          {!readOnly && <Button onClick={() => setModalOpen(true)}>+ Input Setoran Jahit</Button>}
          <Button variant="outline" onClick={() => (window.location.href = `/api/setoran/export?date=${selectedDate}`)}>
            Export ke Excel
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            Keluar
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="text-slate-500">Total Upah Tanggal Ini: </span>
        <span className="font-semibold text-slate-900">Rp {totalUpahTanggalIni.toLocaleString("id-ID")}</span>
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
                Belum ada setoran pada tanggal ini
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
