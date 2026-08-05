"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ScanLine } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OperatorData = { id: number; nama_operator: string; barcode_operator: string };
type PoData = { id: number; nama_po: string; nama_artikel: string; harga_satuan: number; barcode_po: string };

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
  const [operator, setOperator] = useState<OperatorData | null>(null);
  const [po, setPo] = useState<PoData | null>(null);
  const [lookingUpOperator, setLookingUpOperator] = useState(false);
  const [lookingUpPo, setLookingUpPo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const operatorInputRef = useRef<HTMLInputElement>(null);
  const poInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    resetAll();
    focusOperator(80);
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
    setOperator(null);
    setPo(null);
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

    setSubmitting(true);
    try {
      const res = await fetch("/api/setoran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_id: operator.id, po_id: po.id, qty_disetor: qtyNum }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan setoran");
        return;
      }
      toast.success(`${operator.nama_operator} - ${qtyNum} pcs - Rp ${data.total_upah.toLocaleString("id-ID")}`, {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
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
            <ScanLine className="h-5 w-5" /> Input Setoran Jahit
          </DialogTitle>
          <DialogDescription>
            Scan kartu ID operator, scan barcode PO pada bundel, lalu isi QTY dan tekan Enter.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scan_operator">1. Scan ID Operator</Label>
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scan_po">2. Scan PO</Label>
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
            {po && (
              <p className="text-xs text-slate-500">
                Artikel: <span className="font-medium text-slate-700">{po.nama_artikel}</span> - Harga Satuan:{" "}
                <span className="font-medium text-slate-700">Rp {po.harga_satuan.toLocaleString("id-ID")}</span>
              </p>
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
    </Dialog>
  );
}
