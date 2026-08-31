"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { METODE_PEMBAYARAN_OPTIONS } from "@/lib/validators";

type SkuProduct = { id: number; sku: string; nama_produk: string; harga_satuan: number; status: string };
type Artikel = { id: number; kode_artikel: string | null; nama_artikel: string; harga_satuan: number; harga_jual: number; status: string };

// "sku"     = produk Ready Stock dari katalog SKU. Sudah tersedia stoknya,
//             jadi TIDAK akan masuk Board Produksi saat order divalidasi.
// "artikel" = produk custom dipilih dari Database Artikel (Konfigurasi).
// "manual"  = produk custom ketik manual, dipakai kalau belum ada di
//             Database Artikel. Sama seperti "artikel", ini butuh proses
//             produksi sehingga akan masuk Board Produksi saat divalidasi.
type ItemMode = "sku" | "artikel" | "manual";

type ItemRow = {
  mode: ItemMode;
  nama_produk_pilihan: string; // grup nama_produk yang dipilih untuk mode "sku"
  sku_produk_id: number | null;
  artikel_id: number | null;
  nama_artikel: string;
  harga_satuan: string;
  qty: string;
};

const emptyItem = (): ItemRow => ({
  mode: "sku",
  nama_produk_pilihan: "",
  sku_produk_id: null,
  artikel_id: null,
  nama_artikel: "",
  harga_satuan: "",
  qty: "1",
});

function rupiah(value: number) {
  if (!Number.isFinite(value)) return "Rp 0";
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

const MODE_OPTIONS: { value: ItemMode; label: string }[] = [
  { value: "sku", label: "Ready Stock (SKU)" },
  { value: "artikel", label: "Database Artikel" },
  { value: "manual", label: "Ketik Manual" },
];

export default function InputOrderModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [buyerNama, setBuyerNama] = useState("");
  const [buyerTelepon, setBuyerTelepon] = useState("");
  const [namaPo, setNamaPo] = useState("");
  const [deadline, setDeadline] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [dpAmount, setDpAmount] = useState("");
  const [metodePembayaran, setMetodePembayaran] = useState<string>(METODE_PEMBAYARAN_OPTIONS[0]);
  const [catatan, setCatatan] = useState("");
  const [products, setProducts] = useState<SkuProduct[]>([]);
  const [artikels, setArtikels] = useState<Artikel[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/sku-produk")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: SkuProduct[]) => setProducts((data ?? []).filter((p) => p.status === "aktif")))
      .catch(() => setProducts([]));
    fetch("/api/artikel")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Artikel[]) => setArtikels((data ?? []).filter((a) => a.status === "aktif")))
      .catch(() => setArtikels([]));
  }, [open]);

  useEffect(() => {
    if (open) return;
    // Reset form setiap kali modal ditutup, supaya buka lagi selalu bersih.
    setBuyerNama("");
    setBuyerTelepon("");
    setNamaPo("");
    setDeadline("");
    setItems([emptyItem()]);
    setDpAmount("");
    setMetodePembayaran(METODE_PEMBAYARAN_OPTIONS[0]);
    setCatatan("");
  }, [open]);

  // Kelompokkan katalog SKU per nama_produk, supaya SKU (ukuran/varian)
  // jadi pilihan tahap kedua — bukan satu baris terpisah per SKU seperti
  // sebelumnya (bikin dropdown sangat panjang & berulang).
  const productGroups = useMemo(() => {
    const map = new Map<string, SkuProduct[]>();
    for (const p of products) {
      if (!map.has(p.nama_produk)) map.set(p.nama_produk, []);
      map.get(p.nama_produk)!.push(p);
    }
    return [...map.entries()]
      .map(([nama_produk, variants]) => ({
        nama_produk,
        variants: variants.slice().sort((a, b) => a.sku.localeCompare(b.sku)),
      }))
      .sort((a, b) => a.nama_produk.localeCompare(b.nama_produk));
  }, [products]);

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function switchMode(index: number, mode: ItemMode) {
    updateItem(index, {
      mode,
      nama_produk_pilihan: "",
      sku_produk_id: null,
      artikel_id: null,
      nama_artikel: "",
      harga_satuan: "",
    });
  }

  function pickProductGroup(index: number, namaProduk: string) {
    updateItem(index, { nama_produk_pilihan: namaProduk, sku_produk_id: null, nama_artikel: "", harga_satuan: "" });
  }

  function pickVariant(index: number, skuId: string) {
    if (!skuId) {
      updateItem(index, { sku_produk_id: null, nama_artikel: "", harga_satuan: "" });
      return;
    }
    const product = products.find((p) => p.id === Number(skuId));
    if (!product) return;
    updateItem(index, {
      sku_produk_id: product.id,
      nama_artikel: `${product.nama_produk} (${product.sku})`,
      harga_satuan: String(product.harga_satuan),
    });
  }

  function pickArtikel(index: number, artikelId: string) {
    if (!artikelId) {
      updateItem(index, { artikel_id: null, nama_artikel: "", harga_satuan: "" });
      return;
    }
    const artikel = artikels.find((a) => a.id === Number(artikelId));
    if (!artikel) return;
    // Harga jual (bukan harga_satuan/ongkos jahit) yang dipakai sebagai
    // harga order ke customer.
    updateItem(index, {
      artikel_id: artikel.id,
      nama_artikel: artikel.kode_artikel ? `${artikel.nama_artikel} (${artikel.kode_artikel})` : artikel.nama_artikel,
      harga_satuan: artikel.harga_jual > 0 ? String(artikel.harga_jual) : "",
    });
  }

  function addItemRow() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItemRow(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const lineSubtotals = useMemo(
    () => items.map((row) => (Number(row.harga_satuan) || 0) * (Number(row.qty) || 0)),
    [items]
  );
  const total = useMemo(() => lineSubtotals.reduce((sum, v) => sum + v, 0), [lineSubtotals]);
  const dpNumber = Number(dpAmount) || 0;
  const sisaBayar = Math.max(total - dpNumber, 0);

  function isRowValid(row: ItemRow) {
    if (row.mode === "sku") return !!row.sku_produk_id && Number(row.harga_satuan) > 0 && Number(row.qty) > 0;
    if (row.mode === "artikel") return !!row.artikel_id && Number(row.harga_satuan) > 0 && Number(row.qty) > 0;
    return !!row.nama_artikel.trim() && Number(row.harga_satuan) > 0 && Number(row.qty) > 0;
  }

  const readyStockQty = useMemo(
    () => items.filter((r) => r.mode === "sku" && isRowValid(r)).reduce((sum, r) => sum + (Number(r.qty) || 0), 0),
    [items]
  );
  const customQty = useMemo(
    () => items.filter((r) => r.mode !== "sku" && isRowValid(r)).reduce((sum, r) => sum + (Number(r.qty) || 0), 0),
    [items]
  );

  async function handleSubmit() {
    if (!buyerNama.trim()) {
      toast.error("Nama konsumen wajib diisi");
      return;
    }
    if (!namaPo.trim()) {
      toast.error("Nama PO wajib diisi");
      return;
    }
    const validItems = items.filter(isRowValid);
    if (validItems.length === 0) {
      toast.error("Tambahkan minimal 1 produk dengan pilihan/nama, harga, dan qty yang valid");
      return;
    }
    if (dpNumber > total) {
      toast.error("DP tidak boleh lebih besar dari total");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_nama: buyerNama.trim(),
          buyer_telepon: buyerTelepon.trim() || undefined,
          nama_po: namaPo.trim(),
          deadline: deadline || undefined,
          items: validItems.map((row) => ({
            sku_produk_id: row.mode === "sku" ? row.sku_produk_id ?? undefined : undefined,
            artikel_id: row.mode === "artikel" ? row.artikel_id ?? undefined : undefined,
            nama_artikel: row.mode === "manual" ? row.nama_artikel.trim() : undefined,
            harga_satuan: Number(row.harga_satuan),
            qty: Number(row.qty),
          })),
          dp_amount: dpNumber,
          metode_pembayaran: metodePembayaran,
          catatan: catatan.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan order");
        return;
      }
      toast.success(`Order ${data.nomor_order} disimpan. Menunggu validasi admin produksi.`);
      onOpenChange(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Input Order
          </DialogTitle>
          <DialogDescription>
            Input pesanan customer secara manual (misalnya dari chat/telepon). Order akan masuk sebagai permintaan
            Input PO ke produksi dan menunggu validasi admin produksi sebelum diteruskan.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="io-buyer-nama">Nama Konsumen</Label>
              <Input id="io-buyer-nama" value={buyerNama} onChange={(e) => setBuyerNama(e.target.value)} placeholder="Contoh: Wily Ramadhan" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="io-buyer-telepon">No. Telepon (opsional)</Label>
              <Input id="io-buyer-telepon" value={buyerTelepon} onChange={(e) => setBuyerTelepon(e.target.value)} placeholder="08xxxxxxxxxx" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="io-nama-po">Nama PO</Label>
              <Input id="io-nama-po" value={namaPo} onChange={(e) => setNamaPo(e.target.value)} placeholder="Contoh: PO Seragam SMK Jaya" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="io-deadline">Deadline</Label>
              <Input id="io-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Produk</Label>
              <button type="button" onClick={addItemRow} className="flex items-center gap-1 text-xs font-medium text-denim-600 hover:text-denim-700">
                <Plus className="h-3.5 w-3.5" /> Tambah Produk
              </button>
            </div>
            <div className="space-y-2">
              {items.map((row, index) => {
                const group = productGroups.find((g) => g.nama_produk === row.nama_produk_pilihan);
                return (
                  <div key={index} className="rounded-md border border-slate-200 p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 flex-wrap gap-1">
                        {MODE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => switchMode(index, opt.value)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              row.mode === opt.value ? "bg-denim-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItemRow(index)} className="shrink-0 text-slate-400 hover:text-red-600" title="Hapus baris">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Ready Stock (SKU): pilih Nama Produk dulu, lalu Variasi/SKU-nya. */}
                    {row.mode === "sku" && (
                      <div className="mt-2 space-y-2">
                        <select
                          value={row.nama_produk_pilihan}
                          onChange={(e) => pickProductGroup(index, e.target.value)}
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:border-denim-400 focus-visible:ring-2 focus-visible:ring-denim-200"
                        >
                          <option value="">Pilih nama produk...</option>
                          {productGroups.map((g) => (
                            <option key={g.nama_produk} value={g.nama_produk}>
                              {g.nama_produk} ({g.variants.length} varian)
                            </option>
                          ))}
                        </select>
                        {row.nama_produk_pilihan && (
                          <select
                            value={row.sku_produk_id ?? ""}
                            onChange={(e) => pickVariant(index, e.target.value)}
                            className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:border-denim-400 focus-visible:ring-2 focus-visible:ring-denim-200"
                          >
                            <option value="">Pilih variasi (ukuran/SKU)...</option>
                            {group?.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.sku} — {rupiah(v.harga_satuan)}
                              </option>
                            ))}
                          </select>
                        )}
                        {row.sku_produk_id && (
                          <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                            Ready Stock — tidak masuk Board Produksi
                          </span>
                        )}
                      </div>
                    )}

                    {/* Custom dari Database Artikel: butuh proses produksi. */}
                    {row.mode === "artikel" && (
                      <div className="mt-2 space-y-2">
                        <select
                          value={row.artikel_id ?? ""}
                          onChange={(e) => pickArtikel(index, e.target.value)}
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:border-denim-400 focus-visible:ring-2 focus-visible:ring-denim-200"
                        >
                          <option value="">Pilih dari Database Artikel...</option>
                          {artikels.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nama_artikel}
                              {a.kode_artikel ? ` (${a.kode_artikel})` : ""} — {a.harga_jual > 0 ? rupiah(a.harga_jual) : "harga jual belum diisi"}
                            </option>
                          ))}
                        </select>
                        {artikels.length === 0 && (
                          <p className="text-xs text-slate-400">
                            Database Artikel masih kosong. Tambahkan lewat Konfigurasi &gt; Database Artikel, atau pakai &quot;Ketik Manual&quot;.
                          </p>
                        )}
                        {row.artikel_id && (
                          <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                            Custom — akan masuk Board Produksi
                          </span>
                        )}
                        {row.artikel_id && !row.harga_satuan && (
                          <p className="text-xs text-red-500">
                            Artikel ini belum punya Harga Jual. Isi dulu di Konfigurasi &gt; Database Artikel, atau isi harga manual di kolom Harga di bawah.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Custom ketik manual: belum ada di Database Artikel. */}
                    {row.mode === "manual" && (
                      <div className="mt-2 space-y-2">
                        <Input
                          value={row.nama_artikel}
                          onChange={(e) => updateItem(index, { nama_artikel: e.target.value })}
                          placeholder="Nama produk custom"
                        />
                        <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                          Custom — akan masuk Board Produksi
                        </span>
                      </div>
                    )}

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div>
                        <Label>Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={row.qty}
                          onChange={(e) => updateItem(index, { qty: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Harga</Label>
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={row.harga_satuan}
                          disabled={row.mode === "sku" || (row.mode === "artikel" && Number(row.harga_satuan) > 0)}
                          onChange={(e) => updateItem(index, { harga_satuan: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Subtotal</Label>
                        <p className="mt-1 flex h-10 items-center text-sm font-medium text-slate-700 md:h-10">{rupiah(lineSubtotals[index] || 0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
              <span>Total</span>
              <span>{rupiah(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="io-dp">Input DP / Pembayaran (Rp)</Label>
              <Input id="io-dp" type="number" min={0} inputMode="numeric" value={dpAmount} onChange={(e) => setDpAmount(e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="io-metode">Metode Pembayaran</Label>
              <select
                id="io-metode"
                value={metodePembayaran}
                onChange={(e) => setMetodePembayaran(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:border-denim-400 focus-visible:ring-2 focus-visible:ring-denim-200"
              >
                {METODE_PEMBAYARAN_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {dpNumber > 0 && (
            <p className="text-xs text-slate-500">
              Sisa pembayaran setelah DP: <span className="font-medium text-amber-600">{rupiah(sisaBayar)}</span>
            </p>
          )}

          <div>
            <Label htmlFor="io-catatan">Detail Pesanan (opsional)</Label>
            <textarea
              id="io-catatan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan ukuran, warna, request khusus, dsb."
              rows={3}
              className="mt-1 flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-denim-400 focus-visible:ring-2 focus-visible:ring-denim-200"
            />
          </div>

          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {customQty > 0 ? (
              <>
                <span className="font-semibold">{customQty} pcs produk Custom</span> akan masuk Board Produksi setelah divalidasi admin produksi
                {readyStockQty > 0 && (
                  <>
                    , sedangkan <span className="font-semibold">{readyStockQty} pcs Ready Stock (SKU)</span> tidak ikut masuk Board Produksi karena stoknya
                    sudah tersedia
                  </>
                )}
                .
              </>
            ) : readyStockQty > 0 ? (
              <>
                Semua produk pada order ini <span className="font-semibold">Ready Stock (SKU)</span> — order akan langsung ditandai tervalidasi tanpa membuat
                PO produksi, karena stoknya sudah tersedia.
              </>
            ) : (
              <>Order ini akan tersimpan dengan status &quot;Baru&quot; dan menunggu validasi admin produksi.</>
            )}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
