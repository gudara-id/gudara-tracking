"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CheckCircle2, ImagePlus, ScanLine, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";

// Kompres foto di sisi browser sebelum dikirim ke server (disimpan sebagai
// data URL base64 langsung di kolom setoran_jahit.foto_url — lihat catatan
// di EditProfileModal untuk pola yang sama pada avatar). Setoran jauh lebih
// sering diinput daripada profil diedit, jadi di sini fotonya di-resize dulu
// supaya baris DB tidak membengkak.
async function compressPhotoToDataUrl(file: File, maxDimension = 1024, quality = 0.7): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak didukung di browser ini");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

type OperatorData = { id: number; nama_operator: string; barcode_operator: string; status?: string };
type PoData = {
  id: number;
  nama_po: string;
  nama_artikel: string;
  harga_satuan: number;
  barcode_po: string;
  target_qty: number | null;
  qty_terselesaikan: number;
};
type PoListItem = { id: number; nomor_po: string; nama_po: string; nama_artikel: string; status: string };

export default function InputSetoranJahitModal({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [operatorBarcode, setOperatorBarcode] = useState("");
  const [poBarcode, setPoBarcode] = useState("");
  const [qty, setQty] = useState("");
  const [qtyReject, setQtyReject] = useState("");
  const [catatanReject, setCatatanReject] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [operator, setOperator] = useState<OperatorData | null>(null);
  const [po, setPo] = useState<PoData | null>(null);
  const [lookingUpOperator, setLookingUpOperator] = useState(false);
  const [lookingUpPo, setLookingUpPo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanTarget, setScanTarget] = useState<"operator" | "po" | null>(null);
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null);
  const [compressingFoto, setCompressingFoto] = useState(false);

  // Mode input per-langkah: "scan" (default, scan barcode fisik/kamera) atau
  // "manual" (pilih dari dropdown) — fallback kalau alat scanner error/rusak.
  const [operatorMode, setOperatorMode] = useState<"scan" | "manual">("scan");
  const [poMode, setPoMode] = useState<"scan" | "manual">("scan");
  const [operatorList, setOperatorList] = useState<OperatorData[]>([]);
  const [poList, setPoList] = useState<PoListItem[]>([]);

  const operatorInputRef = useRef<HTMLInputElement>(null);
  const poInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    resetAll();
    setOperatorMode("scan");
    setPoMode("scan");
    focusOperator(80);
  }, [open]);

  // Data untuk dropdown mode manual, dimuat sekali tiap modal dibuka.
  useEffect(() => {
    if (!open) return;
    fetch("/api/operator")
      .then((res) => res.json())
      .then((data: OperatorData[]) => setOperatorList(Array.isArray(data) ? data : []))
      .catch(() => setOperatorList([]));
    fetch("/api/po")
      .then((res) => res.json())
      .then((data: PoListItem[]) => setPoList(Array.isArray(data) ? data : []))
      .catch(() => setPoList([]));
  }, [open]);

  useEffect(() => {
    if (open && operator && !po) focusPo();
  }, [open, operator, po]);

  useEffect(() => {
    if (open && po) focusQty();
  }, [open, po]);

  function resetAll() {
    setOperatorBarcode("");
    setPoBarcode("");
    setQty("");
    setQtyReject("");
    setCatatanReject("");
    setShowReject(false);
    setOperator(null);
    setPo(null);
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
      const dataUrl = await compressPhotoToDataUrl(file);
      setFotoDataUrl(dataUrl);
    } catch {
      toast.error("Gagal memproses foto, coba lagi");
    } finally {
      setCompressingFoto(false);
    }
  }

  function resetForNextScan() {
    resetAll();
    focusOperator();
  }

  function focusOperator(delay = 30) {
    window.setTimeout(() => operatorInputRef.current?.focus(), delay);
  }

  function focusPo(delay = 30) {
    window.setTimeout(() => poInputRef.current?.focus(), delay);
  }

  function focusQty(delay = 30) {
    window.setTimeout(() => qtyInputRef.current?.focus(), delay);
  }

  function isScannerCommitKey(e: React.KeyboardEvent<HTMLInputElement>) {
    return e.key === "Enter" || e.key === "Tab";
  }

  async function handleOperatorScan(barcode: string) {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode || lookingUpOperator) return;
    setLookingUpOperator(true);
    try {
      const res = await fetch(`/api/operator/lookup?barcode=${encodeURIComponent(cleanBarcode)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Operator tidak ditemukan");
        setOperatorBarcode("");
        focusOperator();
        return;
      }
      setOperator(data);
    } catch {
      toast.error("Gagal memeriksa barcode operator");
      focusOperator();
    } finally {
      setLookingUpOperator(false);
    }
  }

  function handleOperatorKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isScannerCommitKey(e)) return;
    e.preventDefault();
    handleOperatorScan(operatorBarcode);
  }

  async function handlePoScan(barcode: string) {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode || lookingUpPo) return;
    setLookingUpPo(true);
    try {
      const res = await fetch(`/api/po/lookup?barcode=${encodeURIComponent(cleanBarcode)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "PO tidak ditemukan");
        setPoBarcode("");
        focusPo();
        return;
      }
      setPo(data);
    } catch {
      toast.error("Gagal memeriksa barcode PO");
      focusPo();
    } finally {
      setLookingUpPo(false);
    }
  }

  function handlePoKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isScannerCommitKey(e)) return;
    e.preventDefault();
    handlePoScan(poBarcode);
  }

  // --- Mode manual (fallback kalau scanner error) ---
  function handleOperatorManualSelect(idStr: string) {
    const found = operatorList.find((o) => o.id === Number(idStr));
    if (!found) return;
    setOperator(found);
  }

  async function handlePoManualSelect(idStr: string) {
    if (!idStr) return;
    setLookingUpPo(true);
    try {
      const res = await fetch(`/api/po/lookup?id=${encodeURIComponent(idStr)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "PO tidak ditemukan");
        return;
      }
      setPo(data);
    } catch {
      toast.error("Gagal memeriksa PO");
    } finally {
      setLookingUpPo(false);
    }
  }

  function handleQtyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    handleSubmit();
  }

  async function handleSubmit() {
    if (!operator || !po) {
      toast.error("Scan operator dan PO terlebih dahulu");
      return;
    }

    const qtyNum = Number(qty);
    if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
      toast.error("QTY harus berupa angka bulat lebih dari 0");
      qtyInputRef.current?.focus();
      return;
    }

    const qtyRejectNum = qtyReject.trim() === "" ? 0 : Number(qtyReject);
    if (!Number.isInteger(qtyRejectNum) || qtyRejectNum < 0) {
      toast.error("QTY reject harus berupa angka bulat 0 atau lebih");
      return;
    }
    if (qtyRejectNum > 0 && !catatanReject.trim()) {
      toast.error("Isi catatan alasan reject/cacat terlebih dahulu");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/setoran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator_id: operator.id,
          po_id: po.id,
          qty_disetor: qtyNum,
          qty_reject: qtyRejectNum,
          catatan_reject: catatanReject.trim() || undefined,
          foto_url: fotoDataUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan setoran");
        return;
      }
      toast.success(
        `${operator.nama_operator} - ${qtyNum} pcs - Rp ${data.total_upah.toLocaleString("id-ID")}` +
          (qtyRejectNum > 0 ? ` (${qtyRejectNum} pcs reject dicatat)` : ""),
        { icon: <CheckCircle2 className="h-4 w-4" /> }
      );
      onSaved();
      resetForNextScan();
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-denim-600" /> Input Setoran Jahit
          </DialogTitle>
          <DialogDescription>
            Scan kartu ID operator, scan barcode PO pada bundel, lalu isi QTY dan tekan Enter. Kalau scanner
            error/rusak, klik &quot;Input manual&quot; di sebelah kanan tiap langkah untuk pilih dari daftar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="scan_operator">1. Scan ID Operator</Label>
              <div className="flex shrink-0 items-center gap-3">
                {operatorMode === "scan" && (
                  <button
                    type="button"
                    onClick={() => setScanTarget("operator")}
                    disabled={!!operator}
                    className="tap-shrink inline-flex items-center gap-1 text-xs font-medium text-denim-700 hover:text-denim-900 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Camera className="h-3.5 w-3.5" /> Scan Kamera
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOperatorMode(operatorMode === "scan" ? "manual" : "scan");
                    setOperator(null);
                    setOperatorBarcode("");
                  }}
                  disabled={!!operator}
                  className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  {operatorMode === "scan" ? "Input manual" : "Scan barcode"}
                </button>
              </div>
            </div>
            {operatorMode === "manual" ? (
              <select
                id="scan_operator"
                value={operator?.id ?? ""}
                onChange={(e) => handleOperatorManualSelect(e.target.value)}
                disabled={!!operator}
                className={`h-10 rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-denim-200 ${
                  operator ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-800" : "border-slate-300 bg-white"
                }`}
              >
                <option value="">Pilih operator...</option>
                {operatorList
                  .filter((o) => o.status !== "non-aktif")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nama_operator}
                    </option>
                  ))}
              </select>
            ) : (
              <Input
                id="scan_operator"
                ref={operatorInputRef}
                value={operator ? `${operator.nama_operator} (${operator.barcode_operator})` : operatorBarcode}
                onChange={(e) => setOperatorBarcode(e.target.value)}
                onKeyDown={handleOperatorKeyDown}
                readOnly={!!operator}
                disabled={lookingUpOperator}
                placeholder="Scan kartu ID operator..."
                className={operator ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-800" : ""}
                autoComplete="off"
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="scan_po">2. Scan PO</Label>
              <div className="flex shrink-0 items-center gap-3">
                {poMode === "scan" && (
                  <button
                    type="button"
                    onClick={() => setScanTarget("po")}
                    disabled={!operator || !!po}
                    className="tap-shrink inline-flex items-center gap-1 text-xs font-medium text-denim-700 hover:text-denim-900 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Camera className="h-3.5 w-3.5" /> Scan Kamera
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPoMode(poMode === "scan" ? "manual" : "scan");
                    setPo(null);
                    setPoBarcode("");
                  }}
                  disabled={!operator || !!po}
                  className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  {poMode === "scan" ? "Input manual" : "Scan barcode"}
                </button>
              </div>
            </div>
            {poMode === "manual" ? (
              <select
                id="scan_po"
                value={po?.id ?? ""}
                onChange={(e) => handlePoManualSelect(e.target.value)}
                disabled={!operator || !!po || lookingUpPo}
                className={`h-10 rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-denim-200 ${
                  po ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-800" : "border-slate-300 bg-white"
                }`}
              >
                <option value="">Pilih PO...</option>
                {poList
                  .filter((item) => item.status !== "selesai" && item.status !== "TERKIRIM" && item.status !== "dibatalkan")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nomor_po} - {item.nama_po} ({item.nama_artikel})
                    </option>
                  ))}
              </select>
            ) : (
              <Input
                id="scan_po"
                ref={poInputRef}
                value={po ? `${po.nama_po} (${po.barcode_po})` : poBarcode}
                onChange={(e) => setPoBarcode(e.target.value)}
                onKeyDown={handlePoKeyDown}
                readOnly={!!po}
                disabled={!operator || lookingUpPo}
                placeholder={operator ? "Scan barcode PO pada bundel..." : "Scan operator terlebih dahulu"}
                className={po ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-800" : ""}
                autoComplete="off"
              />
            )}
            {po && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2">
                <p className="text-xs text-slate-500">
                  Artikel: <span className="font-medium text-slate-700">{po.nama_artikel}</span> - Harga Satuan:{" "}
                  <span className="font-medium text-slate-700">Rp {po.harga_satuan.toLocaleString("id-ID")}</span>
                </p>
                {po.target_qty ? (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Progress PO</span>
                      <span className="font-semibold text-slate-800">
                        {po.qty_terselesaikan}
                        {qty && Number(qty) > 0 ? (
                          <span className="text-denim-600"> (+{Number(qty)})</span>
                        ) : null}
                        /{po.target_qty} pcs
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            ((po.qty_terselesaikan + (Number(qty) > 0 ? Number(qty) : 0)) / po.target_qty) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Sisa target:{" "}
                      <span className="font-medium text-slate-700">
                        {Math.max(po.target_qty - po.qty_terselesaikan - (Number(qty) > 0 ? Number(qty) : 0), 0)} pcs
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Sudah terselesaikan:{" "}
                    <span className="font-medium text-slate-700">{po.qty_terselesaikan} pcs</span> (PO ini tidak
                    punya target QTY)
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qty">3. QTY</Label>
            <Input
              id="qty"
              ref={qtyInputRef}
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={handleQtyKeyDown}
              disabled={!po}
              placeholder={po ? "Ketik jumlah lalu tekan Enter" : "Scan PO terlebih dahulu"}
            />
            {po && qty && Number(qty) > 0 && (
              <p className="text-xs text-slate-500">
                Total Upah:{" "}
                <span className="font-semibold text-slate-800">
                  Rp {(Number(qty) * po.harga_satuan).toLocaleString("id-ID")}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {!showReject ? (
              <button
                type="button"
                onClick={() => setShowReject(true)}
                disabled={!po}
                className="self-start text-xs font-medium text-red-600 hover:text-red-700 disabled:pointer-events-none disabled:opacity-40"
              >
                + Catat QTY reject/cacat (opsional)
              </button>
            ) : (
              <div className="rounded-md border border-red-200 bg-red-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="qty_reject" className="text-red-800">
                    QTY Reject/Cacat
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReject(false);
                      setQtyReject("");
                      setCatatanReject("");
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Batal
                  </button>
                </div>
                <Input
                  id="qty_reject"
                  type="number"
                  min="0"
                  step="1"
                  value={qtyReject}
                  onChange={(e) => setQtyReject(e.target.value)}
                  placeholder="Jumlah pcs cacat (tidak dibayar, dicatat terpisah)"
                  className="mt-1.5 border-red-200 bg-white"
                />
                <textarea
                  value={catatanReject}
                  onChange={(e) => setCatatanReject(e.target.value)}
                  placeholder="Alasan reject/cacat, misal: jahitan lepas, ukuran tidak sesuai..."
                  rows={2}
                  className="mt-2 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  QTY bagus di atas tetap yang dibayar. QTY reject cuma dicatat untuk keperluan QC, tidak mengurangi upah.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Foto Hasil Jahit (opsional)</Label>
            {fotoDataUrl ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoDataUrl}
                  alt="Foto hasil jahit"
                  className="h-28 w-28 rounded-md border border-slate-200 object-cover"
                />
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
                disabled={!po || compressingFoto}
                className="tap-shrink inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-denim-400 hover:text-denim-700 disabled:pointer-events-none disabled:opacity-40"
              >
                <ImagePlus className="h-3.5 w-3.5" />
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
            <p className="text-[11px] text-slate-500">
              Untuk dokumentasi kualitas — bisa ditelusuri balik ke operator &amp; tanggal setoran ini kalau ada klaim
              cacat dari customer.
            </p>
          </div>

          <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="ghost" onClick={resetForNextScan} className="text-slate-500">
              Reset Scan
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Tutup
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={submitting || !operator || !po}>
                {submitting ? "Menyimpan..." : "Simpan Setoran"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      <CameraBarcodeScanner
        open={scanTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setScanTarget(null);
        }}
        label={scanTarget === "operator" ? "Scan ID Operator" : "Scan Barcode PO"}
        onDetected={(value) => {
          if (scanTarget === "operator") {
            setOperatorBarcode(value);
            handleOperatorScan(value);
          } else if (scanTarget === "po") {
            setPoBarcode(value);
            handlePoScan(value);
          }
          setScanTarget(null);
        }}
      />
    </Dialog>
  );
}