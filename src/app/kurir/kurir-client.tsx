"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, PackageCheck, Search, Truck, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Sidebar from "@/components/Sidebar";
import { compressPhotoToDataUrl } from "@/lib/image-compress";

type ActivityLogRow = { id: number; user_id: number | null; action: string; metadata: string | null; createdAt: string };

type PO = {
  id: number;
  nomor_po: string;
  nama_po: string;
  nama_artikel: string;
  status: string;
  due_date: string | null;
  activityLogs: ActivityLogRow[];
};

type StageRow = { id: number; nama: string; urutan: number };

export default function KurirClient({ namaLengkap }: { namaLengkap: string }) {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [targetPo, setTargetPo] = useState<PO | null>(null);
  const [nomorResi, setNomorResi] = useState("");
  const [namaPenerima, setNamaPenerima] = useState("");
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null);
  const [compressingFoto, setCompressingFoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    const [stagesRes, poRes, meRes] = await Promise.all([fetch("/api/tahapan"), fetch("/api/po"), fetch("/api/auth/me")]);
    if (stagesRes.ok) setStages(await stagesRes.json());
    if (poRes.ok) setPos(await poRes.json());
    else {
      const body = await poRes.json().catch(() => null);
      toast.error(body?.error || "Gagal memuat data PO");
    }
    if (meRes.ok) setMyUserId((await meRes.json()).id);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const finalStage = useMemo(() => (stages.length ? stages[stages.length - 1].nama : "TERKIRIM"), [stages]);
  const isFinal = useCallback((status: string) => status === finalStage || status === "TERKIRIM" || status === "selesai", [finalStage]);

  const belumTerkirim = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pos
      .filter((po) => !isFinal(po.status))
      .filter((po) => !q || po.nomor_po.toLowerCase().includes(q) || po.nama_po.toLowerCase().includes(q))
      .sort((a, b) => {
        const ua = stages.find((s) => s.nama === a.status)?.urutan ?? 0;
        const ub = stages.find((s) => s.nama === b.status)?.urutan ?? 0;
        return ub - ua; // paling dekat selesai (urutan tahapan tertinggi) di atas
      });
  }, [pos, search, isFinal, stages]);

  const riwayatSaya = useMemo(() => {
    if (myUserId == null) return [];
    return pos
      .filter((po) => isFinal(po.status))
      .filter((po) => po.activityLogs.some((log) => log.action === "po_status_changed" && log.user_id === myUserId))
      .sort((a, b) => {
        const la = a.activityLogs.find((l) => l.action === "po_status_changed" && l.user_id === myUserId)?.createdAt ?? "";
        const lb = b.activityLogs.find((l) => l.action === "po_status_changed" && l.user_id === myUserId)?.createdAt ?? "";
        return lb.localeCompare(la);
      })
      .slice(0, 20);
  }, [pos, myUserId, isFinal]);

  function openTandaiModal(po: PO) {
    setTargetPo(po);
    setNomorResi("");
    setNamaPenerima("");
    setFotoDataUrl(null);
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa foto/gambar");
      return;
    }
    setCompressingFoto(true);
    try {
      setFotoDataUrl(await compressPhotoToDataUrl(file));
    } catch {
      toast.error("Gagal memproses foto, coba lagi");
    } finally {
      setCompressingFoto(false);
    }
  }

  async function submitTandaiTerkirim() {
    if (!targetPo) return;
    if (!fotoDataUrl) {
      toast.error("Foto bukti kirim wajib diambil");
      return;
    }
    setSubmitting(true);
    try {
      const fileName = `Bukti Kirim - Resi: ${nomorResi.trim() || "-"} - Penerima: ${namaPenerima.trim() || "-"}`;
      const res = await fetch("/api/po", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetPo.id,
          status: finalStage,
          attachment: { file_name: fileName, file_url: fotoDataUrl, is_cover: false },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Gagal menandai PO sebagai terkirim");
        return;
      }
      toast.success(`${targetPo.nama_po} ditandai sudah terkirim`);
      setTargetPo(null);
      fetchAll();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar fallbackName={namaLengkap} />
      <main className="min-h-screen min-w-0 flex-1 bg-slate-100 pb-24 text-slate-900 md:pb-0">
        <div className="sticky top-14 z-20 border-b border-dashed border-thread-300 bg-slate-100/95 px-4 py-3 backdrop-blur md:top-0">
          <h1 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-denim-800">
            <Truck className="h-4 w-4 shrink-0" /> Pengiriman
          </h1>
          <p className="truncate text-xs text-slate-500">Halo, {namaLengkap} - tandai PO yang sudah Anda kirim ke customer</p>
        </div>

        <div className="space-y-4 px-3 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Cari nomor PO / nama PO..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-slate-800">
              <PackageCheck className="h-4 w-4 text-thread-500" /> Belum Terkirim ({belumTerkirim.length})
            </div>
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-400">Memuat...</p>
            ) : belumTerkirim.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Tidak ada PO menunggu pengiriman.</p>
            ) : (
              <div className="space-y-2">
                {belumTerkirim.map((po) => (
                  <div key={po.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{po.nama_po}</p>
                      <p className="truncate text-xs text-slate-400">
                        {po.nomor_po} - {po.status}
                        {po.due_date && (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> {format(new Date(po.due_date), "dd/MM/yyyy")}
                          </span>
                        )}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => openTandaiModal(po)}>
                      Tandai Terkirim
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-slate-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Riwayat Terkirim oleh Saya
            </div>
            {riwayatSaya.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Belum ada PO yang Anda tandai terkirim.</p>
            ) : (
              <div className="space-y-2">
                {riwayatSaya.map((po) => {
                  const log = po.activityLogs.find((l) => l.action === "po_status_changed" && l.user_id === myUserId);
                  return (
                    <div key={po.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-emerald-50/60 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{po.nama_po}</p>
                        <p className="truncate text-xs text-slate-400">{po.nomor_po}</p>
                      </div>
                      {log && <p className="shrink-0 text-xs text-emerald-700">{format(new Date(log.createdAt), "dd/MM/yyyy HH:mm")}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <Dialog open={!!targetPo} onOpenChange={(open) => !open && setTargetPo(null)}>
          <DialogContent className="max-w-md">
            {targetPo && (
              <>
                <DialogHeader>
                  <DialogTitle>Tandai Terkirim</DialogTitle>
                  <DialogDescription>
                    {targetPo.nama_po} - {targetPo.nomor_po}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Nomor Resi (opsional)</Label>
                    <Input value={nomorResi} onChange={(e) => setNomorResi(e.target.value)} placeholder="Mis. JNE1234567890" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Nama Penerima (opsional)</Label>
                    <Input value={namaPenerima} onChange={(e) => setNamaPenerima(e.target.value)} placeholder="Nama yang menerima barang" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Foto Bukti Kirim (wajib)</Label>
                    {fotoDataUrl ? (
                      <div className="relative w-fit">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fotoDataUrl} alt="Bukti kirim" className="h-28 w-28 rounded-md border border-slate-200 object-cover" />
                        <button
                          type="button"
                          onClick={() => setFotoDataUrl(null)}
                          className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-1 text-white shadow"
                          aria-label="Hapus foto"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fotoInputRef.current?.click()}
                        disabled={compressingFoto}
                        className="tap-shrink inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-denim-400 hover:text-denim-700 disabled:pointer-events-none disabled:opacity-40"
                      >
                        {compressingFoto ? "Memproses foto..." : "Ambil / Upload Foto"}
                      </button>
                    )}
                    <input
                      ref={fotoInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleFotoChange}
                    />
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <Button type="button" variant="outline" onClick={() => setTargetPo(null)}>
                      Batal
                    </Button>
                    <Button type="button" onClick={submitTandaiTerkirim} disabled={submitting || !fotoDataUrl}>
                      {submitting ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
