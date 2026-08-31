"use client";

import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import OperatorBarcode from "./OperatorBarcode";

type OperatorRow = { id: number; nama_operator: string; barcode_operator: string; status: string };

export default function OperatorBarcodeCardDialog({
  open,
  onOpenChange,
  operators,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operators: OperatorRow[];
}) {
  const title = operators.length === 1 ? `Kartu Barcode - ${operators[0]?.nama_operator ?? ""}` : `Kartu Barcode (${operators.length} operator)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" /> {title}
          </DialogTitle>
          <DialogDescription>
            Kartu ini berisi barcode yang digunakan operator untuk input setoran hasil produksi/jahit lewat scanner.
            Cetak, gunting per kartu, lalu laminating agar tahan lama.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto rounded-md border border-slate-100 bg-slate-50 p-4 print:max-h-none print:overflow-visible print:border-0 print:bg-white print:p-0">
          <div id="print-area" className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-2 print:gap-6">
            {operators.map((op) => (
              <div
                key={op.id}
                className="flex w-full flex-col items-center gap-1 overflow-hidden rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm print:break-inside-avoid print:border print:p-4 print:shadow-none"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">GUDARA - Kartu ID Operator</p>
                <p className="line-clamp-2 text-sm font-bold text-slate-900">{op.nama_operator}</p>
                <div className="w-full px-1">
                  <OperatorBarcode value={op.barcode_operator} height={64} width={2.4} fontSize={12} margin={12} />
                </div>
                <p className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${op.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                  {op.status === "aktif" ? "Aktif" : "Non-aktif"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-500 print:hidden">
          Saat mencetak: pilih skala <span className="font-medium">100% / Actual size</span> (jangan &quot;Fit to page&quot;), pakai kualitas print terbaik, dan kalau
          dilaminating pakai plastik <span className="font-medium">doff/matte</span> — plastik glossy sering memantulkan cahaya sehingga kamera HP gagal membaca barcode.
        </p>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 print:hidden">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Cetak
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
