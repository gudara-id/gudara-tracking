"use client";

import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import OperatorBarcode from "./OperatorBarcode";

type PoLabel = {
  id: number;
  nomor_po: string;
  barcode_po: string;
  nama_po: string;
  nama_artikel: string;
  target_qty: number | null;
  label: string | null;
  due_date: string | null;
};

export default function PoBarcodeLabelsDialog({
  open,
  onOpenChange,
  pos,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pos: PoLabel[];
}) {
  const title = pos.length === 1 ? `Label Barcode - ${pos[0]?.nomor_po ?? ""}` : `Label Barcode PO (${pos.length} PO)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" /> {title}
          </DialogTitle>
          <DialogDescription>Cetak label untuk ditempel di rol kain, bundle, atau dokumen produksi.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto rounded-md border border-slate-100 bg-slate-50 p-4 print:max-h-none print:overflow-visible print:border-0 print:bg-white print:p-0">
          <div id="print-area" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pos.map((po) => (
              <div key={po.id} className="break-inside-avoid rounded-md border border-slate-300 bg-white p-4 shadow-sm print:shadow-none">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">GUDARA - Label PO</p>
                    <p className="text-base font-black text-slate-950">{po.nomor_po}</p>
                  </div>
                  <p className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-600">{po.label || "NO LABEL"}</p>
                </div>
                <p className="text-sm font-semibold text-slate-800">{po.nama_po}</p>
                <p className="mb-2 text-xs text-slate-500">
                  {po.nama_artikel} {po.target_qty ? `- ${po.target_qty} pcs` : ""}
                </p>
                <OperatorBarcode value={po.barcode_po} height={46} width={1.5} fontSize={11} />
                <p className="mt-2 text-[10px] text-slate-500">Due: {po.due_date ? new Date(po.due_date).toLocaleDateString("id-ID") : "-"}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 print:hidden">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Cetak / Simpan PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
