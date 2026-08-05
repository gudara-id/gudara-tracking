"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MasterArtikel = {
  id: number;
  kode_artikel: string | null;
  nama_artikel: string;
  harga_satuan: number;
};

type ArticleRow = {
  artikel_id?: number | null;
  nama_artikel: string;
  harga_satuan: string;
  qty: string;
};

const emptyArticle = (): ArticleRow => ({ artikel_id: null, nama_artikel: "", harga_satuan: "", qty: "" });

export default function InputProduksiModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [namaPo, setNamaPo] = useState("");
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [articles, setArticles] = useState<ArticleRow[]>([emptyArticle()]);
  const [masterArticles, setMasterArticles] = useState<MasterArtikel[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/artikel")
      .then((res) => (res.ok ? res.json() : []))
      .then(setMasterArticles)
      .catch(() => setMasterArticles([]));
  }, [open]);

  function resetForm() {
    setNamaPo("");
    setLabel("");
    setDueDate("");
    setDescription("");
    setArticles([emptyArticle()]);
  }

  function updateArticle(index: number, patch: Partial<ArticleRow>) {
    setArticles((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function selectMasterArticle(index: number, idValue: string) {
    const selected = masterArticles.find((item) => item.id === Number(idValue));
    if (!selected) {
      updateArticle(index, { artikel_id: null, nama_artikel: "", harga_satuan: "" });
      return;
    }
    updateArticle(index, {
      artikel_id: selected.id,
      nama_artikel: selected.nama_artikel,
      harga_satuan: String(selected.harga_satuan),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validArticles = articles.map((item) => ({
      artikel_id: item.artikel_id || null,
      nama_artikel: item.nama_artikel.trim(),
      harga_satuan: Number(item.harga_satuan),
      qty: item.qty ? Number(item.qty) : null,
    }));

    if (!namaPo.trim() || validArticles.some((item) => !item.nama_artikel || !Number.isFinite(item.harga_satuan) || item.harga_satuan <= 0)) {
      toast.error("Nama PO dan semua artikel dengan harga valid wajib diisi");
      return;
    }
    if (validArticles.some((item) => item.qty !== null && (!Number.isInteger(item.qty) || item.qty <= 0))) {
      toast.error("QTY artikel harus berupa angka bulat lebih dari 0");
      return;
    }

    const primary = validArticles[0];
    const totalQty = validArticles.reduce((sum, item) => sum + (item.qty || 0), 0) || null;

    setSubmitting(true);
    try {
      const res = await fetch("/api/po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_po: namaPo,
          nama_artikel: primary.nama_artikel,
          harga_satuan: primary.harga_satuan,
          target_qty: totalQty,
          articles: validArticles,
          label,
          due_date: dueDate,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan PO");
        return;
      }
      toast.success(`PO "${data.nama_po}" berhasil dibuat - ${validArticles.length} artikel`);
      resetForm();
      onCreated();
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Input Produksi Baru</DialogTitle>
          <DialogDescription>Nomor PO dan barcode PO akan dibuat otomatis setelah disimpan.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex max-h-[72vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nama_po">Nama PO / Konsumen</Label>
              <Input id="nama_po" value={namaPo} onChange={(e) => setNamaPo(e.target.value)} autoFocus required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label">Label</Label>
              <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Contoh: MILANO" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Add a more detailed description..."
            />
          </div>

          <div className="rounded-md border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-800">Artikel dalam PO</h3>
              <Button type="button" variant="outline" onClick={() => setArticles((current) => [...current, emptyArticle()])}>
                <Plus className="mr-1 h-4 w-4" /> Tambah Artikel
              </Button>
            </div>
            <div className="space-y-3 p-3">
              {articles.map((article, index) => (
                <div key={index} className="grid gap-2 rounded-md bg-slate-50 p-3 md:grid-cols-[1.1fr_1.4fr_0.8fr_0.8fr_auto]">
                  <select
                    value={article.artikel_id ?? ""}
                    onChange={(e) => selectMasterArticle(index, e.target.value)}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">Manual / pilih artikel</option>
                    {masterArticles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nama_artikel}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={article.nama_artikel}
                    onChange={(e) => updateArticle(index, { nama_artikel: e.target.value, artikel_id: null })}
                    placeholder="Nama artikel"
                    required
                  />
                  <Input
                    type="number"
                    min="1"
                    value={article.harga_satuan}
                    onChange={(e) => updateArticle(index, { harga_satuan: e.target.value })}
                    placeholder="Harga"
                    required
                  />
                  <Input
                    type="number"
                    min="1"
                    value={article.qty}
                    onChange={(e) => updateArticle(index, { qty: e.target.value })}
                    placeholder="QTY"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setArticles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    disabled={articles.length === 1}
                    aria-label="Hapus artikel"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan PO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
