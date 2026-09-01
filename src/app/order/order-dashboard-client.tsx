"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, Ban, CheckCircle2, Copy, Eye, PackagePlus, Printer, Search, ShoppingCart, Square, CheckSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Sidebar from "@/components/Sidebar";
import InputOrderModal from "@/components/InputOrderModal";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/validators";

type OrderRow = {
  id: number;
  nomor_order: string;
  status: OrderStatus;
  buyer_nama: string;
  buyer_telepon: string | null;
  buyer_alamat: string | null;
  catatan: string | null;
  subtotal: number;
  dp_amount: number;
  metode_pembayaran: string | null;
  nama_po: string | null;
  po_id: number | null;
  confirmed_by: number | null;
  confirmed_at: string | null;
  deadline: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  createdAt: string;
  item_count: number;
};

type OrderItem = {
  id: number;
  artikel_id: number | null;
  sku_produk_id: number | null;
  sku_produk_sku: string | null;
  nama_artikel: string;
  harga_satuan: number;
  qty: number;
  subtotal: number;
};
type OrderDetail = OrderRow & { items: OrderItem[] };

function rupiah(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function isOverdue(deadline: string, status: OrderStatus) {
  if (status === "selesai" || status === "dibatalkan") return false;
  return new Date(deadline).getTime() < Date.now();
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  baru: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  baru: "bg-amber-100 text-amber-700",
  diproses: "bg-blue-100 text-blue-700",
  selesai: "bg-emerald-100 text-emerald-700",
  dibatalkan: "bg-slate-200 text-slate-500",
};

export default function OrderDashboardClient({ namaLengkap, role }: { namaLengkap: string; role: string }) {
  const isAdminProduksi = role === "admin_operasional";
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "semua">("semua");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderDetail | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [dpInput, setDpInput] = useState("");
  const [deadlineInput, setDeadlineInput] = useState("");
  const [savingExtra, setSavingExtra] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [inputOrderOpen, setInputOrderOpen] = useState(false);
  const [namaPoInput, setNamaPoInput] = useState("");
  const [validatingPo, setValidatingPo] = useState(false);

  // "Belum divalidasi" = belum pernah divalidasi sama sekali — baik yang
  // nanti jadi PO produksi (custom) maupun yang tidak butuh PO sama sekali
  // karena semua produknya Ready Stock (confirmed_at terisi tanpa po_id).
  const pendingValidationCount = useMemo(
    () => orders.filter((o) => !o.po_id && !o.confirmed_at && o.status !== "dibatalkan").length,
    [orders]
  );

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/order");
      if (res.ok) setOrders(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Sync the DP/deadline edit fields whenever a fresh detail is loaded.
  useEffect(() => {
    if (detail) {
      setDpInput(detail.dp_amount ? String(detail.dp_amount) : "");
      setDeadlineInput(detail.deadline ? detail.deadline.slice(0, 10) : "");
      setNamaPoInput(detail.nama_po ?? "");
    } else {
      setDpInput("");
      setDeadlineInput("");
      setNamaPoInput("");
      setCancelDialogOpen(false);
      setCancelReasonInput("");
    }
  }, [detail]);

  async function openDetail(id: number) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/order/${id}`);
      if (!res.ok) {
        toast.error("Gagal memuat detail order");
        return;
      }
      setDetail(await res.json());
    } finally {
      setDetailLoading(false);
    }
  }

  async function openInvoice(id: number) {
    const res = await fetch(`/api/order/${id}`);
    if (!res.ok) {
      toast.error("Gagal memuat invoice");
      return;
    }
    setInvoiceOrder(await res.json());
  }

  async function changeStatus(id: number, status: OrderStatus) {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/order/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengubah status");
        return;
      }
      toast.success("Status order diperbarui");
      setDetail((prev) => (prev ? { ...prev, status } : prev));
      fetchOrders();
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function saveExtraDetails() {
    if (!detail) return;
    const dpValue = dpInput.trim() === "" ? 0 : Number(dpInput);
    if (!Number.isFinite(dpValue) || dpValue < 0) {
      toast.error("Nominal DP tidak valid");
      return;
    }
    if (dpValue > detail.subtotal) {
      toast.error("DP tidak boleh lebih besar dari subtotal");
      return;
    }
    setSavingExtra(true);
    try {
      const res = await fetch(`/api/order/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dp_amount: dpValue, deadline: deadlineInput || null, nama_po: namaPoInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan detail");
        return;
      }
      toast.success("Detail pembayaran, deadline & Nama PO disimpan");
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              dp_amount: dpValue,
              deadline: deadlineInput ? new Date(deadlineInput).toISOString() : null,
              nama_po: namaPoInput.trim() || null,
            }
          : prev
      );
      fetchOrders();
    } finally {
      setSavingExtra(false);
    }
  }

  // Validasi order jadi PO produksi sungguhan (hanya admin_operasional). Order
  // yang diinput lewat "Input Order" (atau masuk lewat form publik) mendarat
  // sebagai permintaan menunggu validasi ini sebelum tampil di board produksi.
  async function validateIntoPo() {
    if (!detail) return;
    if (!namaPoInput.trim()) {
      toast.error("Isi Nama PO dulu sebelum validasi");
      return;
    }
    setValidatingPo(true);
    try {
      // Pastikan Nama PO terbaru tersimpan dulu kalau ada perubahan yang belum disimpan.
      if (namaPoInput.trim() !== (detail.nama_po ?? "")) {
        const saveRes = await fetch(`/api/order/${detail.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nama_po: namaPoInput.trim() }),
        });
        if (!saveRes.ok) {
          const saveData = await saveRes.json();
          toast.error(saveData.error || "Gagal menyimpan Nama PO");
          return;
        }
      }

      const res = await fetch(`/api/order/${detail.id}/validate-po`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memvalidasi order menjadi PO");
        return;
      }
      if (data.production_required) {
        toast.success(`Order divalidasi. PO ${data.nomor_po} dibuat di board produksi.`);
      } else {
        toast.success("Order divalidasi. Semua produk Ready Stock (SKU) — tidak ada PO produksi yang dibuat.");
      }
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              status: "diproses",
              po_id: (data.po_id as number | null) ?? null,
              confirmed_at: prev.confirmed_at ?? new Date().toISOString(),
            }
          : prev
      );
      fetchOrders();
    } finally {
      setValidatingPo(false);
    }
  }

  async function cancelOrder() {
    if (!detail) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/order/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dibatalkan", cancel_reason: cancelReasonInput.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal membatalkan order");
        return;
      }
      toast.success("Order dibatalkan");
      setDetail(data);
      setCancelDialogOpen(false);
      setCancelReasonInput("");
      fetchOrders();
    } finally {
      setCancelling(false);
    }
  }

  function copyFormLink() {
    const url = `${window.location.origin}/order-form`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link form pemesanan disalin"))
      .catch(() => toast.error("Gagal menyalin link"));
  }

  const filteredOrders = useMemo(() => {
    let result = statusFilter === "semua" ? orders : orders.filter((order) => order.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((order) =>
        [order.nomor_order, order.buyer_nama, order.buyer_telepon, order.catatan]
          .filter(Boolean)
          .some((field) => (field as string).toLowerCase().includes(q))
      );
    }
    return result;
  }, [orders, statusFilter, search]);

  // Buang seleksi untuk order yang sudah tidak tampil di hasil filter saat ini.
  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(filteredOrders.map((o) => o.id));
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredOrders]);

  const allVisibleSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allVisibleSelected) return new Set();
      return new Set(filteredOrders.map((o) => o.id));
    });
  }

  function toggleSelectOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function bulkChangeStatus(status: OrderStatus) {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    const ids = [...selectedIds];
    let successCount = 0;
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`/api/order/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status }),
            });
            return res.ok;
          } catch {
            return false;
          }
        })
      );
      successCount = results.filter(Boolean).length;
      const failedCount = ids.length - successCount;
      if (successCount > 0) {
        toast.success(`${successCount} order diubah ke status "${STATUS_LABEL[status]}"`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} order gagal diperbarui`);
      }
      clearSelection();
      await fetchOrders();
    } finally {
      setBulkUpdating(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 md:flex-row">
      <Sidebar fallbackName={namaLengkap} />

      <main className="flex-1 space-y-5 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">Order</h1>
            <p className="text-sm text-slate-500">Pesanan customer yang masuk lewat form pemesanan, dan invoice-nya.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={copyFormLink}>
              <Copy className="mr-2 h-4 w-4" /> Salin Link Form Pemesanan
            </Button>
            <Button type="button" onClick={() => setInputOrderOpen(true)}>
              <PackagePlus className="mr-2 h-4 w-4" /> Input Order
            </Button>
          </div>
        </div>

        {isAdminProduksi && pendingValidationCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <PackagePlus className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">{pendingValidationCount} permintaan Input PO</span> menunggu validasi
              admin produksi sebelum masuk ke Board Produksi. Buka detail order lalu klik &quot;Validasi &amp; Buat PO&quot;.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["semua", ...ORDER_STATUSES] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`tap-shrink rounded-full px-3 py-1.5 text-xs font-medium ${
                  statusFilter === status ? "bg-denim-900 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"
                }`}
              >
                {status === "semua" ? "Semua" : STATUS_LABEL[status]}
              </button>
            ))}
          </div>

          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. order, nama, telepon..."
              className="pl-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="Hapus pencarian"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ---------- Bulk action toolbar ---------- */}
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-denim-200 bg-denim-50 px-3 py-2.5 shadow-sm">
            <span className="text-sm font-medium text-denim-900">{selectedIds.size} order dipilih</span>
            <span className="text-xs text-denim-400">Ubah status massal ke:</span>
            <div className="flex flex-wrap gap-1.5">
              {ORDER_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={bulkUpdating}
                  onClick={() => bulkChangeStatus(status)}
                  className={`rounded-full px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${STATUS_BADGE[status]} hover:opacity-80`}
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearSelection}
              disabled={bulkUpdating}
              className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-denim-500 hover:bg-denim-100"
            >
              <X className="h-3.5 w-3.5" /> Batalkan pilihan
            </button>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    title={allVisibleSelected ? "Batalkan semua" : "Pilih semua"}
                    className="flex items-center justify-center text-slate-400 hover:text-denim-600"
                  >
                    {allVisibleSelected ? <CheckSquare className="h-4 w-4 text-denim-600" /> : <Square className="h-4 w-4" />}
                  </button>
                </TableHead>
                <TableHead>No. Order</TableHead>
                <TableHead>Pembeli</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-400">
                    Memuat data order...
                  </TableCell>
                </TableRow>
              )}
              {!loading && filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-400">
                    <ShoppingCart className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                    {search
                      ? `Tidak ada order yang cocok dengan "${search}".`
                      : `Belum ada order${statusFilter !== "semua" ? ` dengan status "${STATUS_LABEL[statusFilter]}"` : ""}.`}
                  </TableCell>
                </TableRow>
              )}
              {filteredOrders.map((order) => (
                <TableRow key={order.id} className={selectedIds.has(order.id) ? "bg-denim-50/60" : undefined}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleSelectOne(order.id)}
                      className="flex items-center justify-center text-slate-400 hover:text-denim-600"
                    >
                      {selectedIds.has(order.id) ? <CheckSquare className="h-4 w-4 text-denim-600" /> : <Square className="h-4 w-4" />}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium text-slate-900">
                    <p>{order.nomor_order}</p>
                    {order.nama_po && <p className="mt-0.5 font-sans text-[11px] font-normal text-slate-400">PO: {order.nama_po}</p>}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-800">{order.buyer_nama}</p>
                    {order.buyer_telepon && <p className="text-xs text-slate-400">{order.buyer_telepon}</p>}
                  </TableCell>
                  <TableCell>{order.item_count} item</TableCell>
                  <TableCell className="font-medium">{rupiah(order.subtotal)}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
                    {order.status !== "dibatalkan" && (
                      <span
                        className={`ml-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          order.po_id
                            ? "bg-emerald-50 text-emerald-600"
                            : order.confirmed_at
                              ? "bg-sky-50 text-sky-600"
                              : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {order.po_id ? "PO dibuat" : order.confirmed_at ? "Ready stock (tanpa PO)" : "Menunggu validasi PO"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    <p>{format(new Date(order.createdAt), "dd MMM yyyy HH:mm")}</p>
                    {order.deadline && (
                      <p
                        className={`mt-0.5 font-medium ${
                          isOverdue(order.deadline, order.status) ? "text-red-600" : "text-slate-400"
                        }`}
                      >
                        Deadline {format(new Date(order.deadline), "dd MMM yyyy")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" title="Lihat detail" onClick={() => openDetail(order.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" title="Cetak invoice" onClick={() => openInvoice(order.id)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* ---------- Detail dialog ---------- */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detailLoading || !detail ? (
            <p className="py-6 text-center text-sm text-slate-400">Memuat...</p>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Order {detail.nomor_order}</DialogTitle>
                <DialogDescription>Diajukan {format(new Date(detail.createdAt), "dd MMM yyyy HH:mm")}</DialogDescription>
              </DialogHeader>

              <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1 text-sm">
                {detail.status === "dibatalkan" && (
                  <div className="flex items-start gap-2 rounded-md bg-slate-100 p-3 text-slate-600">
                    <Ban className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="font-medium">Order ini dibatalkan</p>
                      {detail.cancelled_at && (
                        <p className="text-xs text-slate-400">pada {format(new Date(detail.cancelled_at), "dd MMM yyyy HH:mm")}</p>
                      )}
                      {detail.cancel_reason && <p className="mt-0.5 italic text-slate-500">&quot;{detail.cancel_reason}&quot;</p>}
                    </div>
                  </div>
                )}

                {detail.deadline && detail.status !== "dibatalkan" && detail.status !== "selesai" && isOverdue(detail.deadline, detail.status) && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <p className="font-medium">Sudah lewat deadline ({format(new Date(detail.deadline), "dd MMM yyyy")})</p>
                  </div>
                )}

                <div className="rounded-md bg-slate-50 p-3">
                  <p className="font-medium text-slate-800">{detail.buyer_nama}</p>
                  {detail.buyer_telepon && <p className="text-slate-500">{detail.buyer_telepon}</p>}
                  {detail.buyer_alamat && <p className="text-slate-500">{detail.buyer_alamat}</p>}
                  {detail.metode_pembayaran && <p className="mt-1 text-xs text-slate-400">Metode pembayaran: {detail.metode_pembayaran}</p>}
                  {detail.catatan && <p className="mt-1 italic text-slate-400">&quot;{detail.catatan}&quot;</p>}
                </div>

                <div className="flex items-center gap-2 rounded-md border border-slate-100 p-3">
                  {detail.po_id ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" /> Sudah divalidasi &amp; punya PO produksi
                    </span>
                  ) : detail.confirmed_at ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-sky-600">
                      <CheckCircle2 className="h-4 w-4" /> Sudah divalidasi — semua produk Ready Stock (SKU), tanpa PO produksi
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                      <PackagePlus className="h-4 w-4" /> Permintaan Input PO — menunggu validasi admin produksi
                    </span>
                  )}
                </div>

                <div className="divide-y divide-slate-100 rounded-md border border-slate-100">
                  {detail.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="font-medium text-slate-700">{item.nama_artikel}</p>
                        {item.sku_produk_sku && <p className="font-mono text-[11px] text-slate-400">{item.sku_produk_sku}</p>}
                        <p className="text-xs text-slate-400">
                          {item.qty} x {rupiah(item.harga_satuan)}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            item.sku_produk_id ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {item.sku_produk_id ? "Ready Stock" : "Custom · Produksi"}
                        </span>
                      </div>
                      <p className="font-medium text-slate-700">{rupiah(item.subtotal)}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 font-semibold text-slate-900">
                    <span>Subtotal</span>
                    <span>{rupiah(detail.subtotal)}</span>
                  </div>
                  {detail.dp_amount > 0 && (
                    <>
                      <div className="flex items-center justify-between px-3 py-2 text-emerald-600">
                        <span>DP / Terbayar</span>
                        <span>{rupiah(detail.dp_amount)}</span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 font-semibold text-amber-600">
                        <span>Sisa Pembayaran</span>
                        <span>{rupiah(Math.max(detail.subtotal - detail.dp_amount, 0))}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-md border border-slate-100 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Nama PO, Pembayaran &amp; Deadline</p>
                  <div className="mb-2">
                    <Label htmlFor="nama-po-input">Nama PO</Label>
                    <Input
                      id="nama-po-input"
                      value={namaPoInput}
                      onChange={(e) => setNamaPoInput(e.target.value)}
                      placeholder="Contoh: PO Seragam SMK Jaya"
                      className="mt-1"
                      disabled={!!detail.po_id || !!detail.confirmed_at}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="dp-input">DP / Terbayar (Rp)</Label>
                      <Input
                        id="dp-input"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={dpInput}
                        onChange={(e) => setDpInput(e.target.value)}
                        placeholder="0"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deadline-input">Deadline</Label>
                      <Input
                        id="deadline-input"
                        type="date"
                        value={deadlineInput}
                        onChange={(e) => setDeadlineInput(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button type="button" size="sm" className="mt-2 w-full" disabled={savingExtra} onClick={saveExtraDetails}>
                    {savingExtra ? "Menyimpan..." : "Simpan Nama PO, Pembayaran & Deadline"}
                  </Button>

                  {isAdminProduksi && !detail.po_id && !detail.confirmed_at && detail.status !== "dibatalkan" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-2 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={validatingPo}
                      onClick={validateIntoPo}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {validatingPo ? "Memvalidasi..." : "Validasi & Buat PO Produksi"}
                    </Button>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Ubah Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ORDER_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={updatingStatus || detail.status === status}
                        onClick={() => changeStatus(detail.id, status)}
                        className={`rounded-full px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                          detail.status === status ? STATUS_BADGE[status] : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {STATUS_LABEL[status]}
                      </button>
                    ))}
                  </div>
                </div>

                {detail.status !== "dibatalkan" && (
                  <button
                    type="button"
                    onClick={() => setCancelDialogOpen(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Ban className="h-3.5 w-3.5" /> Batalkan Order (Cancel Order)
                  </button>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDetail(null)}>
                  Tutup
                </Button>
                <Button type="button" onClick={() => openInvoice(detail.id)}>
                  <Printer className="mr-2 h-4 w-4" /> Cetak Invoice
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Cancel order confirmation ---------- */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" /> Batalkan Order?
            </DialogTitle>
            <DialogDescription>
              Order {detail?.nomor_order} akan diubah statusnya menjadi &quot;Dibatalkan&quot;. Tindakan ini bisa diubah lagi lewat Ubah Status jika perlu.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="cancel-reason">Alasan pembatalan (opsional)</Label>
            <textarea
              id="cancel-reason"
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              placeholder="Contoh: Customer minta batal, stok habis, dsb."
              rows={3}
              className="mt-1 flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-denim-400 focus-visible:ring-2 focus-visible:ring-denim-200"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
              Batal
            </Button>
            <Button type="button" variant="destructive" onClick={cancelOrder} disabled={cancelling}>
              {cancelling ? "Membatalkan..." : "Ya, Batalkan Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Invoice dialog (printable) ---------- */}
      <InvoiceDialog order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />

      {/* ---------- Input Order manual ---------- */}
      <InputOrderModal open={inputOrderOpen} onOpenChange={setInputOrderOpen} onCreated={fetchOrders} />
    </div>
  );
}

function InvoiceDialog({ order, onClose }: { order: OrderDetail | null; onClose: () => void }) {
  const [companyName, setCompanyName] = useState("GUDARA");
  const [invoiceNote, setInvoiceNote] = useState("");

  useEffect(() => {
    if (!order) return;
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : []))
      .then((settings: { key: string; value: string }[]) => {
        setCompanyName(settings.find((s) => s.key === "company_name")?.value || "GUDARA");
        setInvoiceNote(settings.find((s) => s.key === "invoice_note")?.value || "");
      })
      .catch(() => {});
  }, [order]);

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" /> Invoice {order?.nomor_order}
          </DialogTitle>
          <DialogDescription>Cetak sebagai bukti pesanan untuk customer.</DialogDescription>
        </DialogHeader>

        {order && (
          <div id="print-area" className="rounded-md border border-slate-100 bg-white p-6 print:border-0 print:p-0">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="font-display text-lg font-bold text-slate-900">{companyName}</p>
                <p className="text-xs text-slate-400">Invoice Pesanan</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-mono font-semibold text-slate-900">{order.nomor_order}</p>
                <p className="text-xs text-slate-400">{format(new Date(order.createdAt), "dd MMM yyyy HH:mm")}</p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Ditagihkan Kepada</p>
                <p className="font-medium text-slate-800">{order.buyer_nama}</p>
                {order.buyer_telepon && <p className="text-slate-500">{order.buyer_telepon}</p>}
                {order.buyer_alamat && <p className="text-slate-500">{order.buyer_alamat}</p>}
              </div>
              <div className="text-right">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
                {order.nama_po && <p className="mt-1 text-xs text-slate-400">PO: {order.nama_po}</p>}
                {order.metode_pembayaran && <p className="text-xs text-slate-400">{order.metode_pembayaran}</p>}
              </div>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2">Produk</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Harga</th>
                  <th className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2">
                      <p>{item.nama_artikel}</p>
                      {item.sku_produk_sku && <p className="font-mono text-[11px] text-slate-400">{item.sku_produk_sku}</p>}
                    </td>
                    <td className="py-2 text-center">{item.qty}</td>
                    <td className="py-2 text-right">{rupiah(item.harga_satuan)}</td>
                    <td className="py-2 text-right">{rupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-3 text-right font-semibold text-slate-900">
                    Total
                  </td>
                  <td className="pt-3 text-right font-semibold text-slate-900">{rupiah(order.subtotal)}</td>
                </tr>
                {order.dp_amount > 0 && (
                  <>
                    <tr>
                      <td colSpan={3} className="pt-1 text-right text-emerald-600">
                        DP / Terbayar
                      </td>
                      <td className="pt-1 text-right text-emerald-600">{rupiah(order.dp_amount)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="pt-1 text-right font-semibold text-amber-600">
                        Sisa Pembayaran
                      </td>
                      <td className="pt-1 text-right font-semibold text-amber-600">
                        {rupiah(Math.max(order.subtotal - order.dp_amount, 0))}
                      </td>
                    </tr>
                  </>
                )}
              </tfoot>
            </table>

            {order.catatan && (
              <p className="mt-4 text-xs italic text-slate-400">Catatan customer: &quot;{order.catatan}&quot;</p>
            )}
            {invoiceNote && <p className="mt-6 border-t border-dashed border-slate-200 pt-3 text-center text-xs text-slate-400">{invoiceNote}</p>}
          </div>
        )}

        <DialogFooter className="print:hidden">
          <Button type="button" variant="outline" onClick={onClose}>
            Tutup
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Cetak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
