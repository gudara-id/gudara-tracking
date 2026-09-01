"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Database, GitBranch, ImageOff, KeyRound, Package, Pencil, Printer, Save, ScanBarcode, Search, Settings2, Tag, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Sidebar from "@/components/Sidebar";
import OperatorBarcode from "@/components/OperatorBarcode";
import OperatorBarcodeCardDialog from "@/components/OperatorBarcodeCardDialog";
import { compressPhotoToDataUrl } from "@/lib/image-compress";

type Artikel = { id: number; kode_artikel: string | null; nama_artikel: string; harga_satuan: number; harga_jual: number; status: string };
type SkuProduct = {
  id: number;
  sku: string;
  nama_produk: string;
  harga_satuan: number;
  status: string;
  foto_url: string | null;
  createdAt: string;
};
type AddOnRow = { id: number; nama: string; harga: number; status: string; createdAt: string };
type UserRow = { id: number; username: string; email: string | null; role: string; nama_lengkap: string; createdAt: string };
type OperatorRow = { id: number; barcode_operator: string; nama_operator: string; status: string; createdAt: string };
type AppSetting = { id: number; key: string; value: string; label: string; description: string | null; updatedAt: string; createdAt: string };
type StageRow = { id: number; nama: string; urutan: number; createdAt: string };

export default function KonfigurasiClient({ namaLengkap, role }: { namaLengkap: string; role: string }) {
  const isSales = role === "sales";
  const [activeTab, setActiveTab] = useState<"artikel" | "sku" | "operator" | "user" | "tahapan" | "lainnya">(
    isSales ? "sku" : "artikel"
  );
  const [artikels, setArtikels] = useState<Artikel[]>([]);
  const [skuProducts, setSkuProducts] = useState<SkuProduct[]>([]);
  const [skuLoadError, setSkuLoadError] = useState("");
  const [addOns, setAddOns] = useState<AddOnRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);
  const [artikelForm, setArtikelForm] = useState({ kode_artikel: "", nama_artikel: "", harga_satuan: "", harga_jual: "" });
  const [artikelSearch, setArtikelSearch] = useState("");
  const [selectedArtikelIds, setSelectedArtikelIds] = useState<number[]>([]);
  const [editingArtikel, setEditingArtikel] = useState<Artikel | null>(null);
  const [bulkArtikelOpen, setBulkArtikelOpen] = useState(false);
  const [bulkArtikelForm, setBulkArtikelForm] = useState({ harga_satuan: "", harga_jual: "", status: "" });
  const [savingArtikel, setSavingArtikel] = useState(false);
  const [skuForm, setSkuForm] = useState({ sku: "", nama_produk: "", harga_satuan: "0", status: "aktif", foto_url: "" as string | null });
  const [editingSkuId, setEditingSkuId] = useState<number | null>(null);
  const [compressingFoto, setCompressingFoto] = useState(false);
  const [applyFotoToAllSizes, setApplyFotoToAllSizes] = useState(false);
  const [addOnForm, setAddOnForm] = useState({ nama: "", harga: "" });
  const [userForm, setUserForm] = useState({ username: "", password: "", role: "admin_jahit", nama_lengkap: "", email: "" });
  const [operatorNama, setOperatorNama] = useState("");
  const [stageNama, setStageNama] = useState("");
  const [addingStage, setAddingStage] = useState(false);
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [editingStageNama, setEditingStageNama] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [addingOperator, setAddingOperator] = useState(false);
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<number[]>([]);
  const [printOperators, setPrintOperators] = useState<OperatorRow[] | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserRow | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [selectedSkuIds, setSelectedSkuIds] = useState<number[]>([]);
  const [bulkSkuSaving, setBulkSkuSaving] = useState(false);
  const [bulkHargaInput, setBulkHargaInput] = useState("");
  const [showBulkHargaInput, setShowBulkHargaInput] = useState(false);
  const [skuSearch, setSkuSearch] = useState("");
  const [skuStatusFilter, setSkuStatusFilter] = useState<"semua" | "aktif" | "non-aktif">("semua");

  const fetchConfig = useCallback(async () => {
    // Role "sales" cuma melihat tab SKU Produk Order, jadi tidak perlu
    // fetch data untuk tab-tab lain yang disembunyikan (dan yang API-nya
    // memang dibatasi untuk admin_produksi).
    const skuRes = await fetch("/api/sku-produk");
    if (skuRes.ok) {
      setSkuProducts(await skuRes.json());
      setSkuLoadError("");
    } else {
      const data = await skuRes.json().catch(() => null);
      setSkuLoadError(data?.error || "Gagal memuat SKU produk");
    }

    if (isSales) return;

    const [artikelRes, userRes, operatorRes, settingsRes, stageRes, addOnRes] = await Promise.all([
      fetch("/api/artikel?includeInactive=1"),
      fetch("/api/users"),
      fetch("/api/operator"),
      fetch("/api/settings"),
      fetch("/api/tahapan"),
      fetch("/api/addon"),
    ]);
    if (artikelRes.ok) setArtikels(await artikelRes.json());
    if (userRes.ok) setUsers(await userRes.json());
    if (operatorRes.ok) setOperators(await operatorRes.json());
    if (settingsRes.ok) setSettings(await settingsRes.json());
    if (stageRes.ok) setStages(await stageRes.json());
    if (addOnRes.ok) setAddOns(await addOnRes.json());
  }, [isSales]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function addStage(e: React.FormEvent) {
    e.preventDefault();
    if (!stageNama.trim()) return;
    setAddingStage(true);
    try {
      const res = await fetch("/api/tahapan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: stageNama.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menambah tahapan");
        return;
      }
      toast.success("Tahapan produksi ditambahkan");
      setStageNama("");
      setStages((current) => [...current, data]);
    } finally {
      setAddingStage(false);
    }
  }

  function startEditStage(stage: StageRow) {
    setEditingStageId(stage.id);
    setEditingStageNama(stage.nama);
  }

  function cancelEditStage() {
    setEditingStageId(null);
    setEditingStageNama("");
  }

  async function saveEditStage(id: number) {
    if (!editingStageNama.trim()) return;
    const res = await fetch("/api/tahapan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, nama: editingStageNama.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal mengubah tahapan");
      return;
    }
    toast.success("Tahapan produksi diubah");
    setStages((current) => current.map((stage) => (stage.id === id ? data : stage)));
    cancelEditStage();
  }

  async function moveStage(id: number, direction: "up" | "down") {
    const res = await fetch("/api/tahapan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, direction }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal mengubah urutan tahapan");
      return;
    }
    setStages(data);
  }

  async function deleteStage(id: number) {
    const res = await fetch(`/api/tahapan?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal menghapus tahapan");
      return;
    }
    toast.success("Tahapan produksi dihapus");
    setStages(data);
  }

  async function addArtikel(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/artikel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(artikelForm),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal menambah artikel");
      return;
    }
    toast.success("Artikel ditambahkan");
    setArtikelForm({ kode_artikel: "", nama_artikel: "", harga_satuan: "", harga_jual: "" });
    fetchConfig();
  }

  async function deleteArtikel(id: number) {
    const res = await fetch(`/api/artikel?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal menghapus artikel");
      return;
    }
    toast.success("Artikel dihapus");
    fetchConfig();
  }

  const filteredArtikels = artikels.filter((artikel) => {
    const query = artikelSearch.trim().toLowerCase();
    return !query || artikel.nama_artikel.toLowerCase().includes(query) || artikel.kode_artikel?.toLowerCase().includes(query);
  });
  const allFilteredArtikelsSelected = filteredArtikels.length > 0 && filteredArtikels.every((artikel) => selectedArtikelIds.includes(artikel.id));

  const filteredSkuProducts = skuProducts.filter((product) => {
    const query = skuSearch.trim().toLowerCase();
    const matchesQuery = !query || product.sku.toLowerCase().includes(query) || product.nama_produk.toLowerCase().includes(query);
    const matchesStatus = skuStatusFilter === "semua" || product.status === skuStatusFilter;
    return matchesQuery && matchesStatus;
  });
  const allFilteredSkuSelected = filteredSkuProducts.length > 0 && filteredSkuProducts.every((product) => selectedSkuIds.includes(product.id));
  const skuAktifCount = skuProducts.filter((product) => product.status === "aktif").length;

  function toggleSelectArtikel(id: number) {
    setSelectedArtikelIds((current) => (current.includes(id) ? current.filter((artikelId) => artikelId !== id) : [...current, id]));
  }

  function toggleSelectAllArtikels() {
    const filteredIds = filteredArtikels.map((artikel) => artikel.id);
    setSelectedArtikelIds((current) =>
      allFilteredArtikelsSelected ? current.filter((id) => !filteredIds.includes(id)) : Array.from(new Set([...current, ...filteredIds]))
    );
  }

  async function saveArtikelEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingArtikel) return;
    setSavingArtikel(true);
    try {
      const res = await fetch("/api/artikel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingArtikel),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengubah artikel");
        return;
      }
      setArtikels((current) => current.map((artikel) => (artikel.id === editingArtikel.id ? data[0] : artikel)));
      setEditingArtikel(null);
      toast.success("Artikel diperbarui");
    } finally {
      setSavingArtikel(false);
    }
  }

  async function saveBulkArtikel(e: React.FormEvent) {
    e.preventDefault();
    if (selectedArtikelIds.length === 0) return;
    const changes = Object.fromEntries(Object.entries(bulkArtikelForm).filter(([, value]) => value !== ""));
    if (Object.keys(changes).length === 0) {
      toast.error("Isi minimal satu nilai yang ingin diubah");
      return;
    }
    setSavingArtikel(true);
    try {
      const res = await fetch("/api/artikel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedArtikelIds, ...changes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengubah artikel terpilih");
        return;
      }
      const updated = new Map((data as Artikel[]).map((artikel) => [artikel.id, artikel]));
      setArtikels((current) => current.map((artikel) => updated.get(artikel.id) || artikel));
      setSelectedArtikelIds([]);
      setBulkArtikelForm({ harga_satuan: "", harga_jual: "", status: "" });
      setBulkArtikelOpen(false);
      toast.success(`${data.length} artikel diperbarui`);
    } finally {
      setSavingArtikel(false);
    }
  }

  function startEditSku(product: SkuProduct) {
    setEditingSkuId(product.id);
    setApplyFotoToAllSizes(false);
    setSkuForm({
      sku: product.sku,
      nama_produk: product.nama_produk,
      harga_satuan: String(product.harga_satuan),
      status: product.status,
      foto_url: product.foto_url,
    });
  }

  function resetSkuForm() {
    setEditingSkuId(null);
    setApplyFotoToAllSizes(false);
    setSkuForm({ sku: "", nama_produk: "", harga_satuan: "0", status: "aktif", foto_url: null });
  }

  async function handleSkuFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
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
      setSkuForm((prev) => ({ ...prev, foto_url: dataUrl }));
    } catch {
      toast.error("Gagal memproses foto, coba lagi");
    } finally {
      setCompressingFoto(false);
    }
  }

  async function saveSkuProduct(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/sku-produk", {
      method: editingSkuId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...skuForm, id: editingSkuId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal menyimpan SKU produk");
      return;
    }

    // Opsional: terapkan foto yang sama ke semua ukuran/varian produk ini,
    // supaya admin tidak perlu upload foto satu-satu per SKU.
    if (applyFotoToAllSizes && skuForm.foto_url) {
      const siblings = skuProducts.filter(
        (p) => p.nama_produk.trim().toLowerCase() === skuForm.nama_produk.trim().toLowerCase() && p.id !== data.id
      );
      await Promise.all(
        siblings.map((sibling) =>
          fetch("/api/sku-produk", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: sibling.id,
              sku: sibling.sku,
              nama_produk: sibling.nama_produk,
              harga_satuan: sibling.harga_satuan,
              status: sibling.status,
              foto_url: skuForm.foto_url,
            }),
          }).catch(() => null)
        )
      );
    }

    toast.success(editingSkuId ? "SKU produk diubah" : "SKU produk ditambahkan");
    resetSkuForm();
    fetchConfig();
  }

  async function deleteSkuProduct(id: number) {
    const res = await fetch(`/api/sku-produk?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal menghapus SKU produk");
      return;
    }
    toast.success("SKU produk dihapus");
    if (editingSkuId === id) resetSkuForm();
    fetchConfig();
  }

  function toggleSelectSku(id: number) {
    setSelectedSkuIds((prev) => (prev.includes(id) ? prev.filter((skuId) => skuId !== id) : [...prev, id]));
  }

  function toggleSelectAllSku() {
    const filteredIds = filteredSkuProducts.map((product) => product.id);
    setSelectedSkuIds((prev) =>
      allFilteredSkuSelected ? prev.filter((id) => !filteredIds.includes(id)) : Array.from(new Set([...prev, ...filteredIds]))
    );
  }

  function clearSkuSelection() {
    setSelectedSkuIds([]);
    setShowBulkHargaInput(false);
    setBulkHargaInput("");
  }

  async function bulkUpdateSkuStatus(status: "aktif" | "non-aktif") {
    if (selectedSkuIds.length === 0) return;
    setBulkSkuSaving(true);
    try {
      const res = await fetch("/api/sku-produk/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedSkuIds, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengubah status SKU terpilih");
        return;
      }
      toast.success(`${selectedSkuIds.length} SKU diubah menjadi ${status === "aktif" ? "Aktif" : "Non-aktif"}`);
      clearSkuSelection();
      fetchConfig();
    } finally {
      setBulkSkuSaving(false);
    }
  }

  async function bulkUpdateSkuHarga(e: React.FormEvent) {
    e.preventDefault();
    const harga = Number(bulkHargaInput);
    if (selectedSkuIds.length === 0 || !Number.isFinite(harga) || harga < 0) {
      toast.error("Masukkan harga order yang valid");
      return;
    }
    setBulkSkuSaving(true);
    try {
      const res = await fetch("/api/sku-produk/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedSkuIds, harga_satuan: harga }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengubah harga SKU terpilih");
        return;
      }
      toast.success(`Harga order ${selectedSkuIds.length} SKU diperbarui`);
      clearSkuSelection();
      fetchConfig();
    } finally {
      setBulkSkuSaving(false);
    }
  }

  async function bulkDeleteSku() {
    if (selectedSkuIds.length === 0) return;
    if (!confirm(`Hapus ${selectedSkuIds.length} SKU produk terpilih?`)) return;
    setBulkSkuSaving(true);
    try {
      const res = await fetch("/api/sku-produk/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedSkuIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menghapus SKU terpilih");
        return;
      }
      toast.success("SKU produk terpilih dihapus");
      clearSkuSelection();
      fetchConfig();
    } finally {
      setBulkSkuSaving(false);
    }
  }

  async function addAddOn(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/addon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addOnForm),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal menambah add-on");
      return;
    }
    toast.success("Add-on ditambahkan");
    setAddOnForm({ nama: "", harga: "" });
    fetchConfig();
  }

  async function deleteAddOn(id: number) {
    const res = await fetch(`/api/addon?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal menghapus add-on");
      return;
    }
    toast.success("Add-on dihapus");
    fetchConfig();
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal menambah user");
      return;
    }
    toast.success("User ditambahkan");
    setUserForm({ username: "", password: "", role: "admin_jahit", nama_lengkap: "", email: "" });
    fetchConfig();
  }

  async function deleteUser(id: number) {
    const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal menghapus user");
      return;
    }
    toast.success("User dihapus");
    fetchConfig();
  }

  async function resetUserPassword(id: number, newPassword: string) {
    setResettingPassword(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal reset password");
        return;
      }
      toast.success("Password berhasil direset. Sampaikan password baru ke user secara langsung.");
      setResetPasswordUser(null);
    } finally {
      setResettingPassword(false);
    }
  }

  async function addOperator(e: React.FormEvent) {
    e.preventDefault();
    if (!operatorNama.trim()) return;
    setAddingOperator(true);
    try {
      const res = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama_operator: operatorNama.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menambah operator");
        return;
      }
      toast.success(`Operator ditambahkan - barcode: ${data.barcode_operator}`);
      setOperatorNama("");
      await fetchConfig();
      setPrintOperators([data]);
    } finally {
      setAddingOperator(false);
    }
  }

  async function toggleOperatorStatus(operator: OperatorRow) {
    const nextStatus = operator.status === "aktif" ? "non-aktif" : "aktif";
    const res = await fetch("/api/operator", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: operator.id, status: nextStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal mengubah status operator");
      return;
    }
    toast.success(`Operator ${nextStatus === "aktif" ? "diaktifkan" : "dinonaktifkan"}`);
    fetchConfig();
  }

  async function deleteOperator(id: number) {
    const res = await fetch(`/api/operator?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal menghapus operator");
      return;
    }
    toast.success("Operator dihapus");
    setSelectedOperatorIds((prev) => prev.filter((opId) => opId !== id));
    fetchConfig();
  }

  function toggleSelectOperator(id: number) {
    setSelectedOperatorIds((prev) => (prev.includes(id) ? prev.filter((opId) => opId !== id) : [...prev, id]));
  }

  function toggleSelectAllOperators() {
    setSelectedOperatorIds((prev) => (prev.length === operators.length ? [] : operators.map((op) => op.id)));
  }

  function updateSetting(key: string, value: string) {
    setSettings((current) => current.map((setting) => (setting.key === key ? { ...setting, value } : setting)));
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: settings.map(({ key, value }) => ({ key, value })) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan konfigurasi");
        return;
      }
      setSettings(data);
      toast.success("Konfigurasi disimpan");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar fallbackName={namaLengkap} />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-24 pt-4 md:pb-8 md:py-8">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-denim-900">Konfigurasi</h1>
          <p className="text-sm text-slate-500">Halo, {namaLengkap} - database artikel, user, dan pengaturan operasional</p>
        </div>
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 md:pb-0">
        {(
          isSales
            ? [["sku", "SKU Produk Order"]]
            : [
                ["artikel", "Database Artikel"],
                ["operator", "Operator & Barcode"],
                ["user", "User"],
                ["tahapan", "Tahapan Produksi"],
                ["lainnya", "Konfigurasi Lainnya"],
              ]
        ).map(([key, label]) => (
          <Button key={key} variant={activeTab === key ? "default" : "outline"} className="shrink-0" onClick={() => setActiveTab(key as typeof activeTab)}>
            {label}
          </Button>
        ))}
      </div>

      {activeTab === "artikel" && (
        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <form onSubmit={addArtikel} className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 border-b border-slate-100 pb-4">
              <h2 className="flex items-center gap-2 font-display font-semibold text-denim-800">
                <Database className="h-4 w-4 text-thread-500" /> Artikel Baru
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Simpan kode, nama, dan harga dasar artikel untuk produksi maupun penjualan.</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="artikel-kode">Kode Artikel</Label>
                <p className="mb-1 text-xs text-slate-400">Opsional, tetapi berguna untuk pencarian cepat.</p>
                <Input id="artikel-kode" value={artikelForm.kode_artikel} onChange={(e) => setArtikelForm({ ...artikelForm, kode_artikel: e.target.value })} placeholder="Contoh: RPJ-001" />
              </div>
              <div>
                <Label htmlFor="artikel-nama">Nama Artikel</Label>
                <Input id="artikel-nama" value={artikelForm.nama_artikel} onChange={(e) => setArtikelForm({ ...artikelForm, nama_artikel: e.target.value })} placeholder="Contoh: Raglan Tangan Panjang" required />
              </div>
              <div>
                <Label htmlFor="artikel-harga-jahit">Ongkos Jahit per Pcs</Label>
                <Input id="artikel-harga-jahit" type="number" min="1" value={artikelForm.harga_satuan} onChange={(e) => setArtikelForm({ ...artikelForm, harga_satuan: e.target.value })} required />
                <p className="mt-1 text-xs text-slate-400">Dipakai untuk hitung gaji operator jahit.</p>
              </div>
              <div>
                <Label htmlFor="artikel-harga-jual">Harga Jual</Label>
                <Input id="artikel-harga-jual" type="number" min="0" value={artikelForm.harga_jual} onChange={(e) => setArtikelForm({ ...artikelForm, harga_jual: e.target.value })} placeholder="Kosongkan jika belum dijual" />
                <p className="mt-1 text-xs text-slate-400">Dipakai saat bikin Order/PO dan tampil di katalog customer. Kosongkan kalau artikel ini belum dijual.</p>
              </div>
              <Button type="submit" className="w-full">Tambah Artikel</Button>
            </div>
          </form>

          <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display font-semibold text-denim-800">Daftar Artikel</h2>
                  <p className="mt-1 text-xs text-slate-500">{artikels.length} artikel tersimpan. Centang artikel untuk memperbarui beberapa data sekaligus.</p>
                </div>
                {selectedArtikelIds.length > 0 && (
                  <Button type="button" size="sm" onClick={() => setBulkArtikelOpen(true)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit {selectedArtikelIds.length} Artikel
                  </Button>
                )}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={artikelSearch} onChange={(e) => setArtikelSearch(e.target.value)} placeholder="Cari kode atau nama artikel..." className="pl-9" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input aria-label="Pilih semua artikel yang tampil" type="checkbox" checked={allFilteredArtikelsSelected} onChange={toggleSelectAllArtikels} className="h-4 w-4 accent-denim-700" />
                    </TableHead>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama Artikel</TableHead>
                    <TableHead>Ongkos Jahit</TableHead>
                    <TableHead>Harga Jual</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArtikels.map((artikel) => (
                    <TableRow key={artikel.id} className={selectedArtikelIds.includes(artikel.id) ? "bg-thread-50" : undefined}>
                      <TableCell>
                        <input aria-label={`Pilih ${artikel.nama_artikel}`} type="checkbox" checked={selectedArtikelIds.includes(artikel.id)} onChange={() => toggleSelectArtikel(artikel.id)} className="h-4 w-4 accent-denim-700" />
                      </TableCell>
                      <TableCell>{artikel.kode_artikel ?? "-"}</TableCell>
                      <TableCell className="font-medium">{artikel.nama_artikel}</TableCell>
                      <TableCell>Rp {artikel.harga_satuan.toLocaleString("id-ID")}</TableCell>
                      <TableCell>{artikel.harga_jual > 0 ? `Rp ${artikel.harga_jual.toLocaleString("id-ID")}` : "-"}</TableCell>
                      <TableCell><span className={artikel.status === "aktif" ? "text-emerald-700" : "text-slate-500"}>{artikel.status === "aktif" ? "Aktif" : "Non-aktif"}</span></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" title="Edit artikel" onClick={() => setEditingArtikel({ ...artikel })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" title="Hapus artikel" onClick={() => deleteArtikel(artikel.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredArtikels.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">Tidak ada artikel yang cocok dengan pencarian.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <form onSubmit={addAddOn} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-display font-semibold text-denim-800">
              <Tag className="h-4 w-4 text-thread-500" /> Add-On / Aksesoris
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Tambahan seperti bordir atau aksesoris yang bisa dicentang saat bikin PO. Harganya otomatis ditambahkan
              ke harga satuan artikel (dan ikut menaikkan upah operator jahit).
            </p>
            <div className="space-y-3">
              <div>
                <Label>Nama Add-On</Label>
                <Input value={addOnForm.nama} onChange={(e) => setAddOnForm({ ...addOnForm, nama: e.target.value })} placeholder="Contoh: Bordir Nama" required />
              </div>
              <div>
                <Label>Harga Tambahan</Label>
                <Input type="number" min="1" value={addOnForm.harga} onChange={(e) => setAddOnForm({ ...addOnForm, harga: e.target.value })} required />
              </div>
              <Button type="submit" className="w-full">Tambah Add-On</Button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm lg:col-start-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Add-On</TableHead>
                  <TableHead>Harga Tambahan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addOns.map((addon) => (
                  <TableRow key={addon.id}>
                    <TableCell className="font-medium">{addon.nama}</TableCell>
                    <TableCell>+Rp {addon.harga.toLocaleString("id-ID")}</TableCell>
                    <TableCell>{addon.status}</TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" onClick={() => deleteAddOn(addon.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {addOns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-slate-400">
                      Belum ada add-on. Tambahkan di form sebelah kiri.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {activeTab === "sku" && (
        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <form onSubmit={saveSkuProduct} className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
            <div className="mb-4 border-b border-slate-100 pb-4">
              <h2 className="flex items-center gap-2 font-display font-semibold text-denim-800">
                <Package className="h-4 w-4 text-thread-500" /> {editingSkuId ? "Edit SKU Produk" : "Tambah SKU Produk"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Satu SKU = satu varian ukuran/warna. Gunakan pola nama yang konsisten (mis. KODE-UKURAN) supaya mudah dicari.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Nomor SKU</Label>
                <Input
                  value={skuForm.sku}
                  onChange={(e) => setSkuForm({ ...skuForm, sku: e.target.value })}
                  placeholder="Contoh: WST-XL"
                  required
                />
              </div>
              <div>
                <Label>Nama Produk</Label>
                <Input
                  value={skuForm.nama_produk}
                  onChange={(e) => setSkuForm({ ...skuForm, nama_produk: e.target.value })}
                  placeholder="Contoh: Waistbag Denim"
                  required
                />
              </div>
              <div>
                <Label>Harga Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={skuForm.harga_satuan}
                  onChange={(e) => setSkuForm({ ...skuForm, harga_satuan: e.target.value })}
                  placeholder="Contoh: 85000"
                  required
                />
                <p className="mt-1 text-xs text-slate-400">Harga yang tampil di form pemesanan customer.</p>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={skuForm.status}
                  onChange={(e) => setSkuForm({ ...skuForm, status: e.target.value })}
                  className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm focus-visible:border-denim-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-denim-200"
                >
                  <option value="aktif">Aktif</option>
                  <option value="non-aktif">Non-aktif</option>
                </select>
              </div>
              <div>
                <Label>Foto Produk</Label>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                    {skuForm.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={skuForm.foto_url} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff className="h-5 w-5 text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={compressingFoto}
                      onChange={handleSkuFotoChange}
                      className="text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-denim-900 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-white"
                    />
                    {skuForm.foto_url && (
                      <button
                        type="button"
                        onClick={() => setSkuForm({ ...skuForm, foto_url: null })}
                        className="w-fit text-xs text-slate-400 underline-offset-2 hover:text-red-500 hover:underline"
                      >
                        Hapus foto
                      </button>
                    )}
                  </div>
                </div>
                {compressingFoto && <p className="mt-1 text-xs text-slate-400">Memproses foto...</p>}
              </div>
              {skuForm.foto_url && skuForm.nama_produk && (
                <label className="flex items-start gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={applyFotoToAllSizes}
                    onChange={(e) => setApplyFotoToAllSizes(e.target.checked)}
                    className="mt-0.5"
                  />
                  Terapkan foto ini ke semua ukuran/varian dengan nama produk yang sama
                </label>
              )}
              <p className="text-xs text-slate-500">SKU aktif dengan harga di atas 0 akan tampil di form pemesanan customer.</p>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingSkuId ? "Simpan Perubahan" : "Tambah SKU"}
                </Button>
                {editingSkuId && (
                  <Button type="button" variant="outline" onClick={resetSkuForm}>
                    Batal
                  </Button>
                )}
              </div>
            </div>
          </form>

          <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
            {/* Header: judul, ringkasan jumlah, dan tombol edit massal */}
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display font-semibold text-denim-800">Daftar SKU Produk Order</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {skuProducts.length} SKU tersimpan &middot; {skuAktifCount} aktif &middot; {skuProducts.length - skuAktifCount} non-aktif
                  </p>
                </div>
                {selectedSkuIds.length > 0 && (
                  <span className="w-fit rounded-full bg-denim-50 px-2.5 py-1 text-xs font-medium text-denim-700">
                    {selectedSkuIds.length} SKU dipilih
                  </span>
                )}
              </div>

              {/* Pencarian + filter status */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                    placeholder="Cari SKU atau nama produk..."
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-1.5">
                  {(
                    [
                      ["semua", "Semua"],
                      ["aktif", "Aktif"],
                      ["non-aktif", "Non-aktif"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSkuStatusFilter(value)}
                      className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        skuStatusFilter === value
                          ? "border-denim-800 bg-denim-900 text-white"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bar aksi massal — hanya tampil kalau ada yang dicentang */}
              {selectedSkuIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2">
                  <Button type="button" size="sm" variant="outline" disabled={bulkSkuSaving} onClick={() => bulkUpdateSkuStatus("aktif")}>
                    Aktifkan
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={bulkSkuSaving} onClick={() => bulkUpdateSkuStatus("non-aktif")}>
                    Non-aktifkan
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={bulkSkuSaving} onClick={() => setShowBulkHargaInput((v) => !v)}>
                    Ubah Harga
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkSkuSaving}
                    onClick={bulkDeleteSku}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={bulkSkuSaving} onClick={clearSkuSelection}>
                    <X className="mr-1 h-3.5 w-3.5" /> Batal
                  </Button>
                </div>
              )}
              {showBulkHargaInput && selectedSkuIds.length > 0 && (
                <form onSubmit={bulkUpdateSkuHarga} className="flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-3">
                  <div className="w-40">
                    <Label>Harga order baru</Label>
                    <Input
                      type="number"
                      min="0"
                      value={bulkHargaInput}
                      onChange={(e) => setBulkHargaInput(e.target.value)}
                      placeholder="Contoh: 85000"
                      required
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={bulkSkuSaving}>
                    Terapkan ke {selectedSkuIds.length} SKU
                  </Button>
                </form>
              )}
            </div>

            {/* Mobile: kartu — lebih mudah dibaca & disentuh daripada tabel 7 kolom */}
            <div className="space-y-2 p-3 md:hidden">
              {filteredSkuProducts.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  {skuLoadError || (skuProducts.length === 0 ? "Belum ada SKU produk order." : "Tidak ada SKU yang cocok dengan pencarian.")}
                </p>
              ) : (
                filteredSkuProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`rounded-lg border p-3 shadow-sm ${
                      selectedSkuIds.includes(product.id) ? "border-denim-300 bg-denim-50/60" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        aria-label={`Pilih ${product.nama_produk}`}
                        type="checkbox"
                        checked={selectedSkuIds.includes(product.id)}
                        onChange={() => toggleSelectSku(product.id)}
                        className="mt-3 h-4 w-4 shrink-0 accent-denim-700"
                      />
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {product.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.foto_url} alt={product.nama_produk} className="h-full w-full object-cover" />
                        ) : (
                          <ImageOff className="h-4 w-4 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{product.nama_produk}</p>
                            <p className="font-mono text-xs text-slate-500">{product.sku}</p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              product.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {product.status === "aktif" ? "Aktif" : "Non-aktif"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t border-dashed border-slate-200 pt-2">
                          <span className="text-sm font-semibold text-denim-900">Rp {product.harga_satuan.toLocaleString("id-ID")}</span>
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="ghost" size="icon" onClick={() => startEditSku(product)} title="Edit SKU produk">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => deleteSkuProduct(product.id)} title="Hapus SKU produk">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop / tablet: tabel penuh */}
            <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        aria-label="Pilih semua SKU yang tampil"
                        type="checkbox"
                        checked={allFilteredSkuSelected}
                        onChange={toggleSelectAllSku}
                        className="h-4 w-4 accent-denim-700"
                      />
                    </TableHead>
                    <TableHead className="w-16">Foto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nama Produk</TableHead>
                    <TableHead>Harga Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSkuProducts.map((product) => (
                    <TableRow key={product.id} className={selectedSkuIds.includes(product.id) ? "bg-denim-50/60" : undefined}>
                      <TableCell>
                        <input
                          aria-label={`Pilih ${product.nama_produk}`}
                          type="checkbox"
                          checked={selectedSkuIds.includes(product.id)}
                          onChange={() => toggleSelectSku(product.id)}
                          className="h-4 w-4 accent-denim-700"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          {product.foto_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.foto_url} alt={product.nama_produk} className="h-full w-full object-cover" />
                          ) : (
                            <ImageOff className="h-4 w-4 text-slate-300" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium">{product.sku}</TableCell>
                      <TableCell className="font-medium">{product.nama_produk}</TableCell>
                      <TableCell>Rp {product.harga_satuan.toLocaleString("id-ID")}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            product.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {product.status === "aktif" ? "Aktif" : "Non-aktif"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => startEditSku(product)} title="Edit SKU produk">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => deleteSkuProduct(product.id)} title="Hapus SKU produk">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredSkuProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                        {skuLoadError || (skuProducts.length === 0 ? "Belum ada SKU produk order. Jalankan seed SKU jika data dari Excel belum masuk." : "Tidak ada SKU yang cocok dengan pencarian.")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>
      )}

      {activeTab === "operator" && (
        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <form onSubmit={addOperator} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-display font-semibold text-denim-800">
              <ScanBarcode className="h-4 w-4 text-thread-500" /> Tambah Operator
            </div>
            <div className="space-y-3">
              <div>
                <Label>Nama Operator</Label>
                <Input
                  value={operatorNama}
                  onChange={(e) => setOperatorNama(e.target.value)}
                  placeholder="Nama lengkap operator"
                  required
                />
              </div>
              <p className="text-xs text-slate-500">
                Barcode ID dibuat otomatis saat operator disimpan. Kartu barcode ini yang dipakai operator untuk
                scan input setoran hasil produksi/jahit.
              </p>
              <Button type="submit" className="w-full" disabled={addingOperator}>
                {addingOperator ? "Menyimpan..." : "Tambah & Buat Barcode"}
              </Button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={operators.length > 0 && selectedOperatorIds.length === operators.length}
                  onChange={toggleSelectAllOperators}
                />
                Pilih semua ({operators.length})
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={selectedOperatorIds.length === 0}
                  onClick={() => setPrintOperators(operators.filter((op) => selectedOperatorIds.includes(op.id)))}
                >
                  <Printer className="mr-2 h-4 w-4" /> Cetak Terpilih ({selectedOperatorIds.length})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={operators.length === 0}
                  onClick={() => setPrintOperators(operators)}
                >
                  <Printer className="mr-2 h-4 w-4" /> Cetak Semua
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Nama Operator</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operators.map((operator) => (
                  <TableRow key={operator.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedOperatorIds.includes(operator.id)}
                        onChange={() => toggleSelectOperator(operator.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{operator.nama_operator}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                          {operator.barcode_operator}
                        </span>
                        <OperatorBarcode value={operator.barcode_operator} height={28} width={1.2} fontSize={8} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleOperatorStatus(operator)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          operator.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {operator.status === "aktif" ? "Aktif" : "Non-aktif"}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" onClick={() => setPrintOperators([operator])} title="Cetak barcode">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => deleteOperator(operator.id)} title="Hapus operator">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {operators.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-slate-400">
                      Belum ada operator. Tambahkan operator di form sebelah kiri.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {activeTab === "user" && (
        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <form onSubmit={addUser} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-display font-semibold text-denim-800">
              <UserPlus className="h-4 w-4 text-thread-500" /> Add User
            </div>
            <div className="space-y-3">
              <div>
                <Label>Nama Lengkap</Label>
                <Input value={userForm.nama_lengkap} onChange={(e) => setUserForm({ ...userForm, nama_lengkap: e.target.value })} required />
              </div>
              <div>
                <Label>Username</Label>
                <Input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} required />
              </div>
              <div>
                <Label>Email (opsional)</Label>
                <Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="nama@email.com" />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
              </div>
              <div>
                <Label>Role</Label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:border-denim-400 focus-visible:ring-2 focus-visible:ring-denim-200">
                  <option value="admin_jahit">Admin Jahit</option>
                  <option value="admin_cutting">Admin Cutting</option>
                  <option value="operator_jahit">Operator Jahit</option>
                  <option value="admin_produksi">Admin Produksi</option>
                  <option value="operator_produksi">Operator Produksi</option>
                  <option value="kurir">Kurir</option>
                  <option value="sales">Sales</option>
                </select>
              </div>
              <Button type="submit" className="w-full">Tambah User</Button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.nama_lengkap}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button type="button" variant="ghost" title="Reset password" onClick={() => setResetPasswordUser(user)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => deleteUser(user.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {resetPasswordUser && (
        <ResetPasswordDialog
          user={resetPasswordUser}
          saving={resettingPassword}
          onClose={() => setResetPasswordUser(null)}
          onSubmit={(newPassword) => resetUserPassword(resetPasswordUser.id, newPassword)}
        />
      )}

      {activeTab === "tahapan" && (
        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <form onSubmit={addStage} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-display font-semibold text-denim-800">
              <GitBranch className="h-4 w-4 text-thread-500" /> Tambah Tahapan Produksi
            </div>
            <div className="space-y-3">
              <div>
                <Label>Nama Tahapan</Label>
                <Input
                  value={stageNama}
                  onChange={(e) => setStageNama(e.target.value)}
                  placeholder="Contoh: QC AKHIR"
                  required
                />
              </div>
              <p className="text-xs text-slate-500">
                Tahapan baru ditambahkan sebagai kolom paling kanan di papan produksi. Urutan kolom bisa diatur
                dengan tombol panah di tabel sebelah kanan.
              </p>
              <Button type="submit" className="w-full" disabled={addingStage}>
                {addingStage ? "Menyimpan..." : "Tambah Tahapan"}
              </Button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Urutan</TableHead>
                  <TableHead>Nama Tahapan</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.map((stage, index) => (
                  <TableRow key={stage.id}>
                    <TableCell className="text-slate-400">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {editingStageId === stage.id ? (
                        <Input
                          value={editingStageNama}
                          onChange={(e) => setEditingStageNama(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditStage(stage.id);
                            if (e.key === "Escape") cancelEditStage();
                          }}
                        />
                      ) : (
                        stage.nama
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {editingStageId === stage.id ? (
                          <>
                            <Button type="button" variant="ghost" onClick={() => saveEditStage(stage.id)} title="Simpan">
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" onClick={cancelEditStage} title="Batal">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => moveStage(stage.id, "up")}
                              disabled={index === 0}
                              title="Naikkan urutan"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => moveStage(stage.id, "down")}
                              disabled={index === stages.length - 1}
                              title="Turunkan urutan"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => startEditStage(stage)} title="Ubah nama">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => deleteStage(stage.id)} title="Hapus tahapan">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {stages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-sm text-slate-400">
                      Belum ada tahapan produksi. Tambahkan tahapan di form sebelah kiri.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {activeTab === "lainnya" && (
        <form onSubmit={saveSettings} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-display font-semibold text-denim-900">
                <Settings2 className="h-4 w-4 text-thread-500" /> Konfigurasi Lainnya
              </h2>
              <p className="mt-1 text-sm text-slate-500">Nilai di bawah ini dapat diubah oleh Admin Produksi dan disimpan ke database.</p>
            </div>
            <Button type="submit" disabled={savingSettings || settings.length === 0}>
              <Save className="mr-2 h-4 w-4" /> {savingSettings ? "Menyimpan..." : "Simpan Konfigurasi"}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {settings.map((setting) => (
              <div key={setting.key} className="rounded-md border border-slate-200 p-4">
                <Label htmlFor={`setting-${setting.key}`} className="text-sm font-semibold text-slate-800">
                  {setting.label}
                </Label>
                <p className="mb-3 mt-1 min-h-8 text-xs text-slate-500">{setting.description}</p>
                {setting.key === "payroll_note" ? (
                  <textarea
                    id={`setting-${setting.key}`}
                    value={setting.value}
                    onChange={(event) => updateSetting(setting.key, event.target.value)}
                    className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-denim-200"
                  />
                ) : (
                  <Input
                    id={`setting-${setting.key}`}
                    type={setting.key === "due_soon_days" ? "number" : "text"}
                    min={setting.key === "due_soon_days" ? 0 : undefined}
                    value={setting.value}
                    onChange={(event) => updateSetting(setting.key, event.target.value)}
                  />
                )}
                <p className="mt-2 font-mono text-[11px] text-slate-400">{setting.key}</p>
              </div>
            ))}
            {settings.length === 0 && (
              <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-400 md:col-span-2">
                Memuat konfigurasi...
              </div>
            )}
          </div>
        </form>
      )}
      </main>

      {editingArtikel && (
        <Dialog open onOpenChange={(open) => !open && setEditingArtikel(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Artikel</DialogTitle>
              <DialogDescription>Perbarui data artikel ini. Perubahan harga berlaku untuk transaksi baru.</DialogDescription>
            </DialogHeader>
            <form onSubmit={saveArtikelEdit} className="space-y-4">
              <div>
                <Label htmlFor="edit-artikel-kode">Kode Artikel</Label>
                <Input id="edit-artikel-kode" value={editingArtikel.kode_artikel ?? ""} onChange={(e) => setEditingArtikel({ ...editingArtikel, kode_artikel: e.target.value || null })} />
              </div>
              <div>
                <Label htmlFor="edit-artikel-nama">Nama Artikel</Label>
                <Input id="edit-artikel-nama" value={editingArtikel.nama_artikel} onChange={(e) => setEditingArtikel({ ...editingArtikel, nama_artikel: e.target.value })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit-artikel-jahit">Ongkos Jahit</Label>
                  <Input id="edit-artikel-jahit" type="number" min="1" value={editingArtikel.harga_satuan} onChange={(e) => setEditingArtikel({ ...editingArtikel, harga_satuan: Number(e.target.value) })} required />
                </div>
                <div>
                  <Label htmlFor="edit-artikel-jual">Harga Jual</Label>
                  <Input id="edit-artikel-jual" type="number" min="0" value={editingArtikel.harga_jual} onChange={(e) => setEditingArtikel({ ...editingArtikel, harga_jual: Number(e.target.value) })} required />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-artikel-status">Status</Label>
                <select id="edit-artikel-status" value={editingArtikel.status} onChange={(e) => setEditingArtikel({ ...editingArtikel, status: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus-visible:border-denim-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-denim-200">
                  <option value="aktif">Aktif</option>
                  <option value="non-aktif">Non-aktif</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingArtikel(null)}>Batal</Button>
                <Button type="submit" disabled={savingArtikel}><Check className="h-4 w-4" /> {savingArtikel ? "Menyimpan..." : "Simpan Perubahan"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={bulkArtikelOpen} onOpenChange={(open) => {
        setBulkArtikelOpen(open);
        if (!open) setBulkArtikelForm({ harga_satuan: "", harga_jual: "", status: "" });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {selectedArtikelIds.length} Artikel</DialogTitle>
            <DialogDescription>Isi hanya nilai yang ingin disamakan. Kolom kosong tidak akan mengubah data yang sudah ada.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveBulkArtikel} className="space-y-4">
            <div>
              <Label htmlFor="bulk-artikel-jahit">Ongkos Jahit Baru</Label>
              <Input id="bulk-artikel-jahit" type="number" min="1" value={bulkArtikelForm.harga_satuan} onChange={(e) => setBulkArtikelForm({ ...bulkArtikelForm, harga_satuan: e.target.value })} placeholder="Biarkan kosong untuk tidak mengubah" />
            </div>
            <div>
              <Label htmlFor="bulk-artikel-jual">Harga Jual Baru</Label>
              <Input id="bulk-artikel-jual" type="number" min="0" value={bulkArtikelForm.harga_jual} onChange={(e) => setBulkArtikelForm({ ...bulkArtikelForm, harga_jual: e.target.value })} placeholder="Biarkan kosong untuk tidak mengubah" />
            </div>
            <div>
              <Label htmlFor="bulk-artikel-status">Status Baru</Label>
              <select id="bulk-artikel-status" value={bulkArtikelForm.status} onChange={(e) => setBulkArtikelForm({ ...bulkArtikelForm, status: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus-visible:border-denim-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-denim-200">
                <option value="">Jangan ubah status</option>
                <option value="aktif">Aktif</option>
                <option value="non-aktif">Non-aktif</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkArtikelOpen(false)}>Batal</Button>
              <Button type="submit" disabled={savingArtikel || selectedArtikelIds.length === 0}><Check className="h-4 w-4" /> {savingArtikel ? "Menyimpan..." : "Terapkan Perubahan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <OperatorBarcodeCardDialog
        open={!!printOperators}
        onOpenChange={(open) => !open && setPrintOperators(null)}
        operators={printOperators ?? []}
      />
    </div>
  );
}

/** Lets admin_produksi set a new password for a locked-out user directly —
 * a workaround for when the forgot-password email webhook isn't configured
 * or isn't reaching the user. The new password must be shared with the
 * user out of band (in person, chat, etc.), not emailed automatically. */
function ResetPasswordDialog({
  user,
  saving,
  onClose,
  onSubmit,
}: {
  user: UserRow;
  saving: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    onSubmit(newPassword);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Reset Password — {user.nama_lengkap}
          </DialogTitle>
          <DialogDescription>
            Set password baru untuk user ini secara langsung. Gunakan ini kalau user lupa password dan tidak menerima
            email/notifikasi link reset. Sampaikan password baru ke user secara langsung (chat/tatap muka) — tidak dikirim otomatis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Password Baru</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Konfirmasi Password Baru</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
