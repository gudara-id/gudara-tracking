"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ImageOff, Minus, Plus, ShoppingBag, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Produk katalog gabungan: SKU Produk (varian ukuran, lihat grouping di
// bawah) dan Artikel dari Database Artikel (harga_jual > 0, selalu 1 varian
// tunggal — tidak ada konsep ukuran). "uid" dipakai sebagai key gabungan di
// UI supaya id SkuProduct dan Artikel yang sama-sama mulai dari 1 tidak
// bentrok; "source"+"refId" dipakai saat submit ke /api/public/order.
type Source = "sku" | "artikel";
type Product = {
  uid: string;
  source: Source;
  refId: number;
  sku: string;
  nama_produk: string;
  harga_satuan: number;
  foto_url?: string | null;
};
type ProductGroup = { key: string; nama_produk: string; variants: Product[]; foto_url: string | null; isSkuGroup: boolean };

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"];

function rupiah(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function getSkuVariantLabel(sku: string) {
  const upper = sku.toUpperCase();
  const parts = upper.split("-").filter(Boolean);
  const lastSegment = parts[parts.length - 1];
  if (SIZE_ORDER.includes(lastSegment)) return lastSegment;

  // Sebagian SKU (mis. ENG2XL, GRML, FCXL) menempel langsung tanpa tanda "-"
  // sebelum kode size. Cocokkan akhiran terpanjang dulu ("2XL" sebelum "XL")
  // supaya tidak salah potong.
  const bySizeLengthDesc = [...SIZE_ORDER].sort((a, b) => b.length - a.length);
  for (const size of bySizeLengthDesc) {
    if (upper.length > size.length && upper.endsWith(size)) return size;
  }
  return sku;
}

// Kode dasar produk = SKU minus kode size di akhir (dan tanda "-" penutupnya
// kalau ada). Dipakai untuk mengelompokkan varian ukuran dari produk yang
// SAMA — beda dari mengelompokkan berdasarkan nama_produk, yang di data
// GUDARA sering sama persis untuk beberapa desain/warna berbeda (mis.
// "GUDARA Jersey Bola Negara..." dipakai bareng oleh kode ENG, GRM, FC, AG,
// dst — itu jersey negara yang berbeda-beda, bukan varian ukuran dari satu
// produk). Mengelompokkan lewat kode SKU jauh lebih akurat.
function getSkuBaseCode(sku: string) {
  const upper = sku.toUpperCase();
  const label = getSkuVariantLabel(sku);
  if (label === upper) return upper; // tidak ada kode size yang terdeteksi -> berdiri sendiri
  return upper.slice(0, upper.length - label.length).replace(/-+$/, "") || upper;
}

function sortVariants(a: Product, b: Product) {
  const labelA = getSkuVariantLabel(a.sku);
  const labelB = getSkuVariantLabel(b.sku);
  const indexA = SIZE_ORDER.indexOf(labelA);
  const indexB = SIZE_ORDER.indexOf(labelB);
  if (indexA !== -1 || indexB !== -1) return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  return a.sku.localeCompare(b.sku);
}

function priceRange(variants: Product[]) {
  const prices = variants.map((product) => product.harga_satuan);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? rupiah(min) : `${rupiah(min)} - ${rupiah(max)}`;
}

export default function OrderFormPage() {
  const [companyName, setCompanyName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [selectedSkuByGroup, setSelectedSkuByGroup] = useState<Record<string, string>>({});
  const [buyerNama, setBuyerNama] = useState("");
  const [buyerTelepon, setBuyerTelepon] = useState("");
  const [buyerAlamat, setBuyerAlamat] = useState("");
  const [catatan, setCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nomorOrder, setNomorOrder] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/catalog")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(
        (data: {
          companyName: string;
          products?: { id: number; sku: string; nama_produk: string; harga_satuan: number; foto_url?: string | null }[];
          artikels?: { id: number; kode_artikel: string | null; nama_artikel: string; harga_jual: number }[];
        }) => {
          setCompanyName(data.companyName);
          const skuProducts: Product[] = (data.products ?? []).map((p) => ({
            uid: `sku-${p.id}`,
            source: "sku",
            refId: p.id,
            sku: p.sku,
            nama_produk: p.nama_produk,
            harga_satuan: p.harga_satuan,
            foto_url: p.foto_url,
          }));
          const artikelProducts: Product[] = (data.artikels ?? []).map((a) => ({
            uid: `artikel-${a.id}`,
            source: "artikel",
            refId: a.id,
            sku: a.kode_artikel ?? "",
            nama_produk: a.nama_artikel,
            harga_satuan: a.harga_jual,
            foto_url: null,
          }));
          setProducts([...skuProducts, ...artikelProducts]);
        }
      )
      .catch(() => toast.error("Gagal memuat katalog produk"))
      .finally(() => setLoading(false));
  }, []);

  function setQty(uid: string, qty: number) {
    setQtyById((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[uid];
      else next[uid] = qty;
      return next;
    });
  }

  const productGroups = useMemo<ProductGroup[]>(() => {
    const groupMap = new Map<string, Product[]>();
    for (const product of products) {
      // Artikel tidak punya konsep varian ukuran seperti SKU Produk — tiap
      // artikel selalu jadi grup tersendiri (key dari uid-nya sendiri),
      // supaya tidak salah dikelompokkan lewat parsing kode SKU-nya.
      const key = product.source === "sku" ? getSkuBaseCode(product.sku) : product.uid;
      const current = groupMap.get(key);
      if (current) current.push(product);
      else groupMap.set(key, [product]);
    }
    return [...groupMap.entries()]
      .map(([key, variants]) => {
        const sorted = [...variants].sort(sortVariants);
        // Nama produk kadang beda tipis antar-baris SKU (typo, spasi ganda,
        // dll). Ambil nama yang paling sering dipakai di grup ini sebagai
        // satu perwakilan, bukan sekadar nama variant pertama.
        const nameCounts = new Map<string, number>();
        for (const variant of sorted) nameCounts.set(variant.nama_produk, (nameCounts.get(variant.nama_produk) ?? 0) + 1);
        const representativeName = [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        return {
          key,
          nama_produk: representativeName,
          variants: sorted,
          foto_url: sorted.find((v) => v.foto_url)?.foto_url ?? null,
          isSkuGroup: sorted[0].source === "sku",
        };
      })
      .sort((a, b) => a.nama_produk.localeCompare(b.nama_produk) || a.key.localeCompare(b.key));
  }, [products]);

  function selectedVariant(group: ProductGroup) {
    const selectedUid = selectedSkuByGroup[group.key];
    return group.variants.find((variant) => variant.uid === selectedUid) ?? group.variants[0];
  }

  function groupPhoto(group: ProductGroup, variant: Product) {
    return variant.foto_url ?? group.foto_url;
  }

  const cart = useMemo(
    () =>
      Object.entries(qtyById)
        .map(([uid, qty]) => {
          const product = products.find((item) => item.uid === uid);
          if (!product) return null;
          return { product, qty, subtotal: product.harga_satuan * qty };
        })
        .filter((line): line is { product: Product; qty: number; subtotal: number } => line !== null),
    [qtyById, products]
  );
  const total = cart.reduce((sum, line) => sum + line.subtotal, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!buyerNama.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    if (cart.length === 0) {
      toast.error("Pilih minimal 1 produk");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_nama: buyerNama.trim(),
          buyer_telepon: buyerTelepon.trim(),
          buyer_alamat: buyerAlamat.trim(),
          catatan: catatan.trim(),
          items: cart.map((line) => ({
            sku_produk_id: line.product.source === "sku" ? line.product.refId : undefined,
            artikel_id: line.product.source === "artikel" ? line.product.refId : undefined,
            qty: line.qty,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengirim pesanan");
        return;
      }
      setNomorOrder(data.nomor_order);
    } catch {
      toast.error("Terjadi kesalahan jaringan, coba lagi");
    } finally {
      setSubmitting(false);
    }
  }

  if (nomorOrder) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-denim-950 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl shadow-black/40">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
          <h1 className="mb-1 font-display text-xl font-bold text-slate-900">Pesanan Terkirim!</h1>
          <p className="mb-4 text-sm text-slate-500">
            Terima kasih, pesanan Anda sudah kami terima. Tim kami akan menghubungi Anda untuk konfirmasi.
          </p>
          <p className="rounded-md bg-slate-50 py-2 font-mono text-sm font-semibold text-slate-700">{nomorOrder}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="border-b border-denim-950 bg-denim-900 px-4 py-5 text-white">
        <p className="font-display text-lg font-bold">{companyName || "Form Pemesanan"}</p>
        <p className="text-sm text-denim-200">Isi form di bawah untuk membuat pesanan.</p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold text-slate-900">
            <ShoppingCart className="h-4 w-4" /> Pilih Produk
          </h2>
          {loading && (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="aspect-square bg-slate-100" />
                  <div className="space-y-2 p-2.5">
                    <div className="h-3 w-full rounded bg-slate-100" />
                    <div className="h-3 w-2/3 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && products.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Belum ada produk tersedia.</p>}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {productGroups.map((group) => {
              const product = selectedVariant(group);
              const qty = qtyById[product.uid] ?? 0;
              const photo = groupPhoto(group, product);
              const activeLines = group.variants.filter((variant) => (qtyById[variant.uid] ?? 0) > 0);
              const inCart = activeLines.length > 0;
              return (
                <div
                  key={group.key}
                  className={`group overflow-hidden rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md ${
                    inCart ? "border-thread-400 ring-1 ring-thread-200" : "border-slate-200"
                  }`}
                >
                  {/* Product image - square, marketplace style */}
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt={group.nama_produk}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-denim-100 to-denim-50 px-3 text-center">
                        <p className="line-clamp-4 font-display text-xs font-bold leading-tight text-denim-400">
                          {group.nama_produk}
                        </p>
                      </div>
                    )}
                    {group.isSkuGroup && group.variants.length > 1 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        {group.variants.length} Ukuran
                      </span>
                    )}
                    {group.isSkuGroup && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-thread-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                        {getSkuVariantLabel(product.sku)}
                      </span>
                    )}
                    {!photo && <ImageOff className="absolute bottom-2 right-2 h-3.5 w-3.5 text-denim-200" />}
                  </div>

                  <div className="space-y-2 p-2.5">
                    <p className="line-clamp-2 min-h-8 text-xs font-semibold leading-tight text-slate-900">{group.nama_produk}</p>
                    <p className="text-sm font-bold text-denim-900">{priceRange(group.variants)}</p>

                    {group.isSkuGroup && group.variants.length > 1 && (
                      <select
                        aria-label="Pilih ukuran / SKU"
                        value={product.uid}
                        onChange={(event) =>
                          setSelectedSkuByGroup((prev) => ({
                            ...prev,
                            [group.key]: event.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium focus-visible:border-denim-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-denim-200"
                      >
                        {group.variants.map((variant) => (
                          <option key={variant.uid} value={variant.uid}>
                            Size {getSkuVariantLabel(variant.sku)} · {rupiah(variant.harga_satuan)}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      {group.isSkuGroup ? (
                        <p className="min-w-0 truncate text-[11px] font-medium text-slate-500">
                          Ukuran: <span className="text-slate-700">{getSkuVariantLabel(product.sku)}</span>
                        </p>
                      ) : (
                        <span />
                      )}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQty(product.uid, qty - 1)}
                          disabled={qty === 0}
                          className="tap-shrink flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-inset ring-slate-200 disabled:opacity-40"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(product.uid, qty + 1)}
                          className="tap-shrink flex h-7 w-7 items-center justify-center rounded-full bg-denim-900 text-white"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {inCart && (
                      <div className="rounded-md bg-thread-50 px-2 py-1 text-[10px] font-medium text-thread-700">
                        {group.isSkuGroup
                          ? activeLines.map((variant) => `${getSkuVariantLabel(variant.sku)} x${qtyById[variant.uid]}`).join(", ")
                          : `x${qtyById[product.uid]}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_420px] lg:items-start">
          <div className="space-y-5">
            <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-sm font-bold text-slate-900">Data Pembeli</h2>
              <div className="space-y-1.5">
                <Label>Nama</Label>
                <Input value={buyerNama} onChange={(e) => setBuyerNama(e.target.value)} required placeholder="Nama lengkap" />
              </div>
              <div className="space-y-1.5">
                <Label>No. Telepon / WhatsApp</Label>
                <Input value={buyerTelepon} onChange={(e) => setBuyerTelepon(e.target.value)} placeholder="08xxxxxxxxxx" />
              </div>
              <div className="space-y-1.5">
                <Label>Alamat</Label>
                <Input value={buyerAlamat} onChange={(e) => setBuyerAlamat(e.target.value)} placeholder="Alamat pengiriman" />
              </div>
              <div className="space-y-1.5">
                <Label>Catatan (opsional)</Label>
                <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan tambahan untuk pesanan Anda" />
              </div>
            </section>
          </div>

          <div id="ringkasan-pesanan" className="space-y-5 lg:sticky lg:top-5">
            {cart.length > 0 && (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 font-display text-sm font-bold text-slate-900">Ringkasan Pesanan</h2>
                <div className="space-y-2 text-sm">
                  {cart.map((line) => (
                    <div key={line.product.uid} className="flex justify-between gap-3 text-slate-600">
                      <span className="min-w-0">
                        <span className="line-clamp-2">{line.product.nama_produk}</span>
                        <span className="text-xs text-slate-400">
                          {line.product.source === "sku" ? `Ukuran ${getSkuVariantLabel(line.product.sku)} ` : ""}x{line.qty}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium">{rupiah(line.subtotal)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                    <span>Total</span>
                    <span>{rupiah(total)}</span>
                  </div>
                </div>
              </section>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Mengirim..." : "Kirim Pesanan"}
            </Button>
          </div>
        </div>

        {cart.length > 0 && (
          <a
            href="#ringkasan-pesanan"
            className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-denim-950 bg-denim-900 px-4 py-3 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)] lg:hidden"
          >
            <span className="flex items-center gap-2 text-sm">
              <ShoppingBag className="h-4 w-4" />
              <span className="font-semibold">{cart.reduce((sum, line) => sum + line.qty, 0)} item</span>
            </span>
            <span className="font-display text-sm font-bold">{rupiah(total)}</span>
          </a>
        )}

        {false && (
          <>
            <section>
              <button
                type="button"
                className="tap-shrink flex h-8 w-8 items-center justify-center rounded-full bg-denim-900 text-white"
                    >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </section>
          </>
        )}
      </form>
    </main>
  );
}
