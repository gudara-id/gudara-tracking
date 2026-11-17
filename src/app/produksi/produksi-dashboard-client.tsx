"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeftCircle, ArrowRightCircle, Barcode, BarChart3, Ban, CalendarDays, CheckSquare, Circle, Link, ListChecks, MoreHorizontal, Package, Paperclip, Plus, Printer, RotateCcw, Search, Settings2, Tag, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import InputProduksiModal from "@/components/InputProduksiModal";
import PoBarcodeLabelsDialog from "@/components/PoBarcodeLabelsDialog";
import OperatorBarcode from "@/components/OperatorBarcode";
import Sidebar from "@/components/Sidebar";
import { KANBAN_PO_STATUSES, CANCELLED_PO_STATUS } from "@/lib/validators";
import { compressPhotoToDataUrl } from "@/lib/image-compress";

type ChecklistItem = { id: number; text: string; is_done: boolean; createdAt: string };
type Member = { id: number; user_id: number; nama_lengkap: string; username: string };

type PO = {
  id: number;
  nomor_po: string;
  barcode_po: string;
  nama_po: string;
  nama_artikel: string;
  harga_satuan: number;
  target_qty: number | null;
  status: string;
  label: string | null;
  due_date: string | null;
  description: string | null;
  createdAt: string;
  creator: { nama_lengkap: string };
  articles: { id: number; nama_artikel: string; harga_satuan: number; qty: number | null }[];
  attachments: { id: number; file_name: string; file_url: string; is_cover: boolean; createdAt: string }[];
  activityLogs: { id: number; action: string; summary: string; createdAt: string; user: { nama_lengkap: string; username: string } | null }[];
  members: Member[];
  checklistItems: ChecklistItem[];
};

type StageRow = { id: number; nama: string; urutan: number };
type SimpleUser = { id: number; nama_lengkap: string; username: string; role: string };

// Color runs cool (denim) to warm (thread) as a PO moves toward sewing, then
// settles into green once it's shipped — the palette itself tells you where
// a stage sits in the line. Stages are now configurable (Konfigurasi >
// Tahapan Produksi), so colors are assigned by position in this palette
// rather than hardcoded per stage name.
const STAGE_PALETTE = [
  { accent: "bg-denim-600", border: "border-denim-600" },
  { accent: "bg-denim-500", border: "border-denim-500" },
  { accent: "bg-denim-400", border: "border-denim-400" },
  { accent: "bg-sky-500", border: "border-sky-500" },
  { accent: "bg-cyan-500", border: "border-cyan-500" },
  { accent: "bg-thread-400", border: "border-thread-400" },
  { accent: "bg-thread-500", border: "border-thread-500" },
  { accent: "bg-orange-500", border: "border-orange-500" },
  { accent: "bg-orange-600", border: "border-orange-600" },
  { accent: "bg-emerald-500", border: "border-emerald-500" },
  { accent: "bg-emerald-700", border: "border-emerald-700" },
];

function shortName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getDueState(dueDate: string | null, thresholdDays = 2) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Lewat deadline", className: "bg-red-100 text-red-700 ring-red-200", urgent: true };
  if (diffDays <= thresholdDays) return { label: diffDays === 0 ? "Due hari ini" : `Due ${diffDays} hari`, className: "bg-amber-100 text-amber-700 ring-amber-200", urgent: true };
  return { label: format(due, "dd MMM"), className: "bg-slate-100 text-slate-600 ring-slate-200", urgent: false };
}

export default function ProduksiDashboardClient({
  namaLengkap,
  role,
  embedded = false,
}: {
  namaLengkap: string;
  role: string;
  /** When rendered as a tab inside a combined dashboard, skip the own Sidebar/page chrome. */
  embedded?: boolean;
}) {
  const isAdmin = role === "admin_operasional";
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PO | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [labelFilter, setLabelFilter] = useState("");
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [dueSoonDays, setDueSoonDays] = useState(2);
  const [stages, setStages] = useState<StageRow[]>([]);
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [checklistText, setChecklistText] = useState("");
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [membersMenuOpen, setMembersMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [columnMenuStage, setColumnMenuStage] = useState<string | null>(null);
  const [cancelledOpen, setCancelledOpen] = useState(false);
  const [cancelProcessingId, setCancelProcessingId] = useState<number | null>(null);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const checklistInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const dueDateInputRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const stageNames = useMemo(
    () => (stages.length ? stages.map((stage) => stage.nama) : (KANBAN_PO_STATUSES as unknown as string[])),
    [stages]
  );

  const stageColors = useMemo(() => {
    const map = new Map<string, { accent: string; border: string }>();
    stageNames.forEach((name, index) => map.set(name, STAGE_PALETTE[index % STAGE_PALETTE.length]));
    return map;
  }, [stageNames]);

  function stageAccent(stage: string) {
    return stageColors.get(stage)?.accent ?? "bg-slate-400";
  }
  function stageBorder(stage: string) {
    return stageColors.get(stage)?.border ?? "border-slate-400";
  }

  const normalizeStage = useCallback(
    (status: string) => {
      if (status === CANCELLED_PO_STATUS) return status;
      if (stageNames.includes(status)) return status;
      if (status === "selesai") return stageNames[stageNames.length - 1] ?? status;
      if (status === "berjalan") return stageNames.find((name) => name === "SIAP JAHIT") ?? stageNames[0] ?? status;
      return stageNames[0] ?? status;
    },
    [stageNames]
  );

  const fetchPos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/po?ts=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error((data && data.error) || `Gagal memuat data PO (${res.status})`);
        return;
      }
      setPos(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Terjadi kesalahan jaringan saat memuat data PO");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStages = useCallback(async () => {
    try {
      const res = await fetch("/api/tahapan");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error((data && data.error) || `Gagal memuat tahapan produksi (${res.status})`);
        return;
      }
      setStages(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Terjadi kesalahan jaringan saat memuat tahapan produksi");
    }
  }, []);

  useEffect(() => {
    fetchPos();
    fetchStages();
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : []))
      .then(setAllUsers)
      .catch(() => undefined);
  }, [fetchPos, fetchStages]);

  // Hitung berapa order (dari /order, termasuk hasil "Input Order" manual)
  // yang belum divalidasi jadi PO produksi, supaya admin_operasional lihat ada
  // permintaan menunggu langsung dari Board Produksi.
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/order")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { status: string; po_id: number | null }[]) => {
        const list = Array.isArray(data) ? data : [];
        setPendingOrderCount(list.filter((o) => !o.po_id && o.status !== "dibatalkan").length);
      })
      .catch(() => undefined);
  }, [isAdmin]);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : []))
      .then((settings) => {
        const value = settings.find((setting: { key: string }) => setting.key === "due_soon_days")?.value;
        const days = Number(value);
        if (Number.isFinite(days) && days >= 0) setDueSoonDays(days);
      })
      .catch(() => undefined);
  }, []);

  const labelOptions = useMemo(() => {
    return Array.from(new Set(pos.map((po) => po.label).filter(Boolean) as string[])).sort();
  }, [pos]);

  const filteredPos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pos.filter((po) => {
      const matchesSearch =
        !q ||
        [po.nomor_po, po.barcode_po, po.nama_po, po.nama_artikel, po.label || ""].some((value) =>
          value.toLowerCase().includes(q)
        );
      const matchesLabel = !labelFilter || po.label === labelFilter;
      return matchesSearch && matchesLabel;
    });
  }, [pos, searchQuery, labelFilter]);

  // Quick-jump suggestions shown in a popup right under the search box —
  // matches only on the search text (ignores the label dropdown), capped so
  // the popup doesn't get unwieldy on a long PO list.
  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return pos
      .filter((po) =>
        [po.nomor_po, po.barcode_po, po.nama_po, po.nama_artikel, po.label || ""].some((value) =>
          value.toLowerCase().includes(q)
        )
      )
      .slice(0, 8);
  }, [pos, searchQuery]);

  useEffect(() => {
    setSearchOpen(searchQuery.trim().length > 0);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const cancelledPos = useMemo(() => pos.filter((po) => po.status === CANCELLED_PO_STATUS), [pos]);

  const dashboard = useMemo(() => {
    const active = pos.filter((po) => po.status !== CANCELLED_PO_STATUS);
    const running = active.filter((po) => normalizeStage(po.status) !== stageNames[stageNames.length - 1]).length;
    const done = active.length - running;
    const dueSoon = active.filter((po) => getDueState(po.due_date, dueSoonDays)?.urgent).length;
    const monthCounts = pos.reduce<Record<string, number>>((counts, po) => {
      const key = format(new Date(po.createdAt), "MMM yy");
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
    return { running, done, dueSoon, monthCounts };
  }, [pos, dueSoonDays, normalizeStage, stageNames]);

  const groupedPos = useMemo(() => {
    return stageNames.reduce<Record<string, PO[]>>((groups, stage) => {
      groups[stage] = filteredPos.filter((po) => normalizeStage(po.status) === stage);
      return groups;
    }, {});
  }, [filteredPos, stageNames, normalizeStage]);

  async function updateStatus(po: PO, status: string) {
    if (normalizeStage(po.status) === status) return;
    setUpdatingId(po.id);

    const previous = pos;
    const optimistic = pos.map((item) => (item.id === po.id ? { ...item, status } : item));
    setPos(optimistic);
    if (selectedPo?.id === po.id) setSelectedPo({ ...po, status });

    try {
      const res = await fetch("/api/po", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: po.id, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPos(previous);
        if (selectedPo?.id === po.id) setSelectedPo(po);
        toast.error(data.error || "Gagal memindahkan PO");
        return;
      }
      setPos((current) => current.map((item) => (item.id === po.id ? data : item)));
      if (selectedPo?.id === po.id) setSelectedPo(data);
      toast.success(`PO dipindahkan ke ${status}`);
    } catch {
      setPos(previous);
      if (selectedPo?.id === po.id) setSelectedPo(po);
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setUpdatingId(null);
      setDraggedId(null);
    }
  }

  async function addPhotoAttachment(po: PO, file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Pilih file gambar (JPG, PNG, atau WebP)");
      return;
    }
    try {
      const dataUrl = await compressPhotoToDataUrl(file, 1280, 0.78);
      await updatePoMeta(po, {
        attachment: {
          file_name: file.name,
          file_url: dataUrl,
          is_cover: !po.attachments?.some((item) => item.is_cover),
        },
      });
      toast.success("Gambar berhasil ditambahkan");
    } catch {
      toast.error("Gambar gagal diproses");
    }
  }

  async function updatePoMeta(po: PO, patch: Partial<Pick<PO, "label" | "due_date" | "description">> & { attachment?: { file_name: string; file_url: string; is_cover?: boolean } }) {
    const res = await fetch("/api/po", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: po.id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal menyimpan detail PO");
      return;
    }
    setPos((current) => current.map((item) => (item.id === po.id ? data : item)));
    setSelectedPo(data);
    toast.success("Detail PO disimpan");
  }

  async function cancelPo(po: PO) {
    if (!confirm(`Batalkan PO ${po.nomor_po}? PO akan keluar dari board, tapi data & histori produksinya tetap tersimpan dan bisa dipulihkan lagi.`)) return;
    setCancelProcessingId(po.id);
    try {
      const res = await fetch("/api/po", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: po.id, status: CANCELLED_PO_STATUS }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal membatalkan PO");
        return;
      }
      setPos((current) => current.map((item) => (item.id === po.id ? data : item)));
      if (selectedPo?.id === po.id) setSelectedPo(null);
      toast.success(`PO ${po.nomor_po} dibatalkan`);
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setCancelProcessingId(null);
    }
  }

  async function restorePo(po: PO) {
    const targetStage = stageNames[0];
    if (!targetStage) return;
    setCancelProcessingId(po.id);
    try {
      const res = await fetch("/api/po", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: po.id, status: targetStage }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memulihkan PO");
        return;
      }
      setPos((current) => current.map((item) => (item.id === po.id ? data : item)));
      toast.success(`PO ${po.nomor_po} dipulihkan ke ${targetStage}`);
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setCancelProcessingId(null);
    }
  }

  async function deletePoPermanently(po: PO) {
    if (!confirm(`Hapus permanen PO ${po.nomor_po}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setCancelProcessingId(po.id);
    try {
      const res = await fetch(`/api/po?id=${po.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Gagal menghapus PO");
        return;
      }
      setPos((current) => current.filter((item) => item.id !== po.id));
      if (selectedPo?.id === po.id) setSelectedPo(null);
      toast.success(`PO ${po.nomor_po} dihapus permanen`);
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setCancelProcessingId(null);
    }
  }

  function moveSelected(direction: -1 | 1) {
    if (!selectedPo) return;
    const currentIndex = stageNames.indexOf(normalizeStage(selectedPo.status));
    const nextStage = stageNames[currentIndex + direction];
    if (nextStage) updateStatus(selectedPo, nextStage);
  }

  function patchSelectedPo(poId: number, patch: Partial<PO>) {
    setPos((current) => current.map((item) => (item.id === poId ? { ...item, ...patch } : item)));
    setSelectedPo((current) => (current && current.id === poId ? { ...current, ...patch } : current));
  }

  async function addChecklistItem(po: PO) {
    const text = checklistText.trim();
    if (!text) return;
    setAddingChecklist(true);
    try {
      const res = await fetch("/api/po/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_id: po.id, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menambah checklist");
        return;
      }
      patchSelectedPo(po.id, { checklistItems: [...(po.checklistItems ?? []), data] });
      setChecklistText("");
    } finally {
      setAddingChecklist(false);
    }
  }

  async function toggleChecklistItem(po: PO, item: ChecklistItem) {
    const res = await fetch("/api/po/checklist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, is_done: !item.is_done }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal mengubah checklist");
      return;
    }
    patchSelectedPo(po.id, {
      checklistItems: (po.checklistItems ?? []).map((existing) => (existing.id === item.id ? data : existing)),
    });
  }

  async function deleteChecklistItem(po: PO, item: ChecklistItem) {
    const res = await fetch(`/api/po/checklist?id=${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Gagal menghapus checklist");
      return;
    }
    patchSelectedPo(po.id, { checklistItems: (po.checklistItems ?? []).filter((existing) => existing.id !== item.id) });
  }

  async function moveStageColumn(stageNameToMove: string, direction: "up" | "down") {
    const stage = stages.find((item) => item.nama === stageNameToMove);
    if (!stage) {
      toast.error("Data tahapan belum termuat, coba refresh halaman");
      return;
    }
    const res = await fetch("/api/tahapan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: stage.id, direction }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal mengubah urutan tahapan");
      return;
    }
    setStages(data);
    setColumnMenuStage(null);
  }

  async function toggleMember(po: PO, user: SimpleUser) {
    const isMember = (po.members ?? []).some((member) => member.user_id === user.id);
    const res = await fetch(
      isMember ? `/api/po/members?po_id=${po.id}&user_id=${user.id}` : "/api/po/members",
      isMember
        ? { method: "DELETE" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ po_id: po.id, user_id: user.id }),
          }
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Gagal mengubah member");
      return;
    }
    patchSelectedPo(po.id, { members: data });
  }

  return (
    <div className={embedded ? "flex flex-col" : "flex min-h-screen flex-col md:flex-row"}>
      {!embedded && <Sidebar fallbackName={namaLengkap} />}
      <main className={embedded ? "min-w-0 flex-1 bg-slate-100 text-slate-900" : "min-h-screen min-w-0 flex-1 bg-slate-100 pb-24 text-slate-900 md:pb-0"}>
      <div className={embedded ? "sticky top-0 z-20 border-b border-dashed border-thread-300 bg-slate-100/95 px-4 py-3 backdrop-blur" : "sticky top-14 z-20 border-b border-dashed border-thread-300 bg-slate-100/95 px-4 py-3 backdrop-blur md:top-0"}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-sm font-bold uppercase tracking-wide text-denim-800">Gudara Production Board</h1>
            <p className="text-xs text-slate-500">Halo, {namaLengkap} - {filteredPos.length} dari {pos.length} PO tampil di board</p>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            <Button className="shrink-0" onClick={() => setModalOpen(true)}>+ Input Produksi</Button>
            <Button variant="outline" className="shrink-0" onClick={() => setBarcodeOpen(true)}>
              <Printer className="mr-2 h-4 w-4" /> Cetak Label PO
            </Button>
            <Button variant="outline" className="shrink-0" onClick={fetchPos}>
              Refresh
            </Button>
            {isAdmin && (
              <Button variant="outline" className="shrink-0 border-red-200 text-red-600 hover:bg-red-50" onClick={() => setCancelledOpen(true)}>
                <Ban className="mr-2 h-4 w-4" /> Dibatalkan ({cancelledPos.length})
              </Button>
            )}
          </div>
        </div>

        {isAdmin && pendingOrderCount > 0 && (
          <a
            href="/order"
            className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 hover:bg-amber-100"
          >
            <Package className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold">{pendingOrderCount} permintaan Input PO</span> dari halaman Order menunggu
              validasi kamu sebelum tampil di board ini. Klik untuk buka halaman Order.
            </span>
          </a>
        )}
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_220px]">
          <div ref={searchBoxRef} className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => {
                if (searchQuery.trim()) setSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearchOpen(false);
              }}
              className="bg-white pl-9"
              placeholder="Cari nomor PO, barcode, nama PO, artikel, atau label"
            />
            {searchOpen && searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
                {searchSuggestions.length === 0 ? (
                  <p className="px-3 py-3 text-center text-xs text-slate-400">Tidak ada PO yang cocok.</p>
                ) : (
                  <>
                    {searchSuggestions.map((po) => (
                      <button
                        key={po.id}
                        type="button"
                        onClick={() => {
                          setSelectedPo(po);
                          setSearchOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900">
                            {po.nomor_po} - {po.nama_po}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {po.nama_artikel}
                            {po.label ? ` · ${po.label}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {normalizeStage(po.status)}
                        </span>
                      </button>
                    ))}
                    {filteredPos.length > searchSuggestions.length && (
                      <p className="border-t border-slate-100 px-3 py-1.5 text-center text-[11px] text-slate-400">
                        +{filteredPos.length - searchSuggestions.length} PO lain cocok, board di bawah juga sudah difilter
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <select
            value={labelFilter}
            onChange={(event) => setLabelFilter(event.target.value)}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Semua label</option>
            {labelOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="grid gap-3 px-3 py-4 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
        <div className="rounded-md border-l-4 border-denim-500 bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs font-semibold uppercase text-slate-500">PO berjalan</p>
          <p className="mt-1 font-display text-2xl font-bold text-denim-800">{dashboard.running}</p>
        </div>
        <div className="rounded-md border-l-4 border-emerald-500 bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs font-semibold uppercase text-slate-500">PO selesai</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-700">{dashboard.done}</p>
        </div>
        <div className="rounded-md border-l-4 border-thread-400 bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-xs font-semibold uppercase text-slate-500">Deadline dekat/lewat</p>
          <p className="mt-1 font-display text-2xl font-bold text-thread-600">{dashboard.dueSoon}</p>
        </div>
        <div className="rounded-md bg-white p-4 shadow-sm ring-1 ring-black/5 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <BarChart3 className="h-4 w-4 text-denim-600" /> Total produksi per bulan
          </div>
          <div className="flex h-28 items-end gap-3 overflow-x-auto">
            {Object.entries(dashboard.monthCounts).length ? (
              Object.entries(dashboard.monthCounts).map(([month, count]) => {
                const max = Math.max(...Object.values(dashboard.monthCounts), 1);
                return (
                  <div key={month} className="flex min-w-14 flex-col items-center gap-2">
                    <div className="flex h-20 w-8 items-end rounded bg-slate-100">
                      <div className="w-full rounded bg-denim-500" style={{ height: `${Math.max(12, (count / max) * 80)}px` }} />
                    </div>
                    <p className="text-[10px] font-medium text-slate-500">{month}</p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400">Belum ada data produksi</p>
            )}
          </div>
        </div>
      </section>

      <section className="relative flex h-[65vh] min-h-[380px] snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-4 md:h-[calc(100vh-276px)] md:min-h-[430px] md:snap-none">
        {columnMenuStage && <div className="fixed inset-0 z-20" onClick={() => setColumnMenuStage(null)} />}
        {stageNames.map((stage, stageIndex) => (
          <div
            key={stage}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              const po = pos.find((item) => item.id === draggedId);
              if (po) updateStatus(po, stage);
            }}
            className="flex h-full w-[85vw] shrink-0 snap-center flex-col rounded-lg bg-white shadow-sm ring-1 ring-black/5 sm:w-[272px] md:snap-align-none"
          >
            <div className={`flex items-center justify-between border-b-2 px-3 py-2 ${stageBorder(stage)}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stageAccent(stage)}`} />
                <h2 className="truncate font-display text-[11px] font-bold uppercase text-slate-700">{stage}</h2>
              </div>
              <div className="relative flex items-center gap-2 text-xs text-slate-500">
                <span>{groupedPos[stage]?.length ?? 0}</span>
                <button
                  type="button"
                  onClick={() => setColumnMenuStage((current) => (current === stage ? null : stage))}
                  className="rounded p-0.5 hover:bg-slate-100"
                  aria-label="Menu tahapan"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {columnMenuStage === stage && (
                  <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 text-left text-xs normal-case text-slate-700 shadow-lg">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                      onClick={() => {
                        setColumnMenuStage(null);
                        setModalOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 text-slate-500" /> Tambah PO
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={stageIndex === 0}
                      onClick={() => moveStageColumn(stage, "up")}
                    >
                      <ArrowLeftCircle className="h-3.5 w-3.5 text-slate-500" /> Pindah kolom ke kiri
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={stageIndex === stageNames.length - 1}
                      onClick={() => moveStageColumn(stage, "down")}
                    >
                      <ArrowRightCircle className="h-3.5 w-3.5 text-slate-500" /> Pindah kolom ke kanan
                    </button>
                    <a
                      href="/konfigurasi"
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <Settings2 className="h-3.5 w-3.5 text-slate-500" /> Kelola tahapan produksi
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {loading ? (
                <div className="rounded-md bg-white p-3 text-xs text-slate-400">Memuat...</div>
              ) : groupedPos[stage]?.length ? (
                groupedPos[stage].map((po) => {
                  const dueState = getDueState(po.due_date, dueSoonDays);
                  const coverAttachment = po.attachments?.find((attachment) => attachment.is_cover) ?? po.attachments?.[0];
                  return (
                    <button
                      key={po.id}
                      draggable
                      onDragStart={() => setDraggedId(po.id)}
                      onClick={() => setSelectedPo(po)}
                      disabled={updatingId === po.id}
                      className={`group w-full overflow-hidden rounded-md border-t-4 bg-white text-left shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 ${
                        stageBorder(stage)
                      } ${dueState?.urgent ? "ring-thread-300" : "ring-slate-200"}`}
                    >
                      {coverAttachment?.file_url && (
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Buka preview gambar ${po.nama_po}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setPreviewUrl(coverAttachment.file_url);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              setPreviewUrl(coverAttachment.file_url);
                            }
                          }}
                          className="relative h-28 w-full cursor-zoom-in overflow-hidden bg-slate-100"
                        >
                          <img
                            src={coverAttachment.file_url}
                            alt={`Gambar ${po.nama_po} — klik untuk preview`}
                            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                          />
                          {po.attachments.length > 1 && (
                            <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                              +{po.attachments.length - 1} gambar
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 px-2.5 pt-2.5">
                        <span className="font-mono text-[10px] text-slate-400">{po.nomor_po}</span>
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${stageAccent(stage)}`}>
                          {shortName(po.nama_artikel)}
                        </span>
                      </div>
                      <div className="space-y-2 p-2.5">
                        <div>
                          <p className="line-clamp-2 text-xs font-semibold uppercase leading-4 text-slate-800">
                            {po.nama_po} - {po.nama_artikel}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {po.target_qty ? `${po.target_qty} pcs` : `${po.articles?.length || 1} artikel`}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {format(new Date(po.createdAt), "dd MMM")}
                          </span>
                          {dueState && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${dueState.className}`}>
                              {dueState.urgent && <AlertTriangle className="h-3 w-3" />}
                              {dueState.label}
                            </span>
                          )}
                          {po.checklistItems?.length ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              <ListChecks className="h-3 w-3" />
                              {po.checklistItems.filter((item) => item.is_done).length}/{po.checklistItems.length}
                            </span>
                          ) : null}
                          {po.members?.length ? (
                            <span className="inline-flex -space-x-1.5">
                              {po.members.slice(0, 3).map((member) => (
                                <span
                                  key={member.id}
                                  title={member.nama_lengkap}
                                  className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-denim-600 text-[9px] font-bold text-white"
                                >
                                  {shortName(member.nama_lengkap)}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-400">
                  Kosong
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="border-t border-dashed border-slate-200 px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 hover:text-denim-700"
            >
              + Tambah PO
            </button>
          </div>
        ))}
      </section>

      <InputProduksiModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={() => {
          setModalOpen(false);
          fetchPos();
        }}
      />

      <Dialog
        open={!!selectedPo}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPo(null);
            setAddMenuOpen(false);
            setMembersMenuOpen(false);
            setChecklistText("");
          }
        }}
      >
        <DialogContent className="max-w-5xl overflow-x-hidden p-0">
          {selectedPo && (
            <div className="grid min-h-0 max-h-[92vh] overflow-x-hidden overflow-y-auto lg:max-h-[86vh] lg:grid-cols-[1.35fr_0.85fr] lg:overflow-hidden">
              <div className="min-w-0 lg:overflow-y-auto">
                <div className={`flex h-28 items-center justify-between gap-3 border-b-4 px-6 ${stageBorder(normalizeStage(selectedPo.status))} bg-denim-900`}>
                  <span className="min-w-0 truncate font-mono text-xs text-denim-300">{selectedPo.barcode_po}</span>
                  <span
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold text-white shadow-sm ${stageAccent(normalizeStage(selectedPo.status))}`}
                  >
                    {shortName(selectedPo.nama_artikel)}
                  </span>
                </div>
                <div className="min-w-0 p-6">
                  <DialogHeader>
                    <DialogTitle className="flex items-start gap-3 text-xl sm:text-2xl">
                      <Circle className="mt-1 h-5 w-5 shrink-0" />
                      <span className="min-w-0 break-words">
                        {selectedPo.nama_po} - {selectedPo.nama_artikel}
                        {selectedPo.target_qty ? ` - (${selectedPo.target_qty} PCS)` : ""}
                      </span>
                    </DialogTitle>
                    <DialogDescription className="break-words">{selectedPo.nomor_po}</DialogDescription>
                  </DialogHeader>

                  {selectedPo.attachments?.length ? (
                    <div className="mt-4 flex flex-col gap-3">
                      {selectedPo.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setPreviewUrl(attachment.file_url)}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPreviewUrl(attachment.file_url)}
                          className={`group relative block cursor-zoom-in overflow-hidden rounded-lg border bg-slate-100 ${
                            attachment.is_cover ? "order-first" : ""
                          }`}
                        >
                          <img
                            src={attachment.file_url}
                            alt={attachment.file_name}
                            className={`${attachment.is_cover ? "h-64 sm:h-80" : "h-32"} w-full object-cover transition group-hover:scale-[1.02]`}
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-8">
                            <p className="text-[10px] font-medium text-white/90">
                              {attachment.is_cover ? "COVER PO" : "ATTACHMENT"}
                            </p>
                            <p className="truncate text-xs font-semibold text-white">
                              {attachment.file_name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedPo.members?.length ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {selectedPo.members.map((member) => (
                        <span
                          key={member.id}
                          title={member.nama_lengkap}
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-denim-600 text-[10px] font-bold text-white shadow-sm"
                        >
                          {shortName(member.nama_lengkap)}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="-mx-6 mt-5 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
                    <div className="relative shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setAddMenuOpen((open) => !open);
                          setMembersMenuOpen(false);
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" /> Add
                      </Button>
                      {addMenuOpen && (
                        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                            onClick={() => {
                              setAddMenuOpen(false);
                              setTimeout(() => checklistInputRef.current?.focus(), 50);
                            }}
                          >
                            <ListChecks className="h-4 w-4 text-slate-500" /> Item checklist
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                            onClick={() => {
                              setAddMenuOpen(false);
                              setMembersMenuOpen(true);
                            }}
                          >
                            <Users className="h-4 w-4 text-slate-500" /> Member
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                            onClick={() => {
                              setAddMenuOpen(false);
                              setTimeout(() => labelInputRef.current?.focus(), 50);
                            }}
                          >
                            <Tag className="h-4 w-4 text-slate-500" /> Label
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                            onClick={() => {
                              setAddMenuOpen(false);
                              setTimeout(() => dueDateInputRef.current?.focus(), 50);
                            }}
                          >
                            <CalendarDays className="h-4 w-4 text-slate-500" /> Due date
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                            onClick={() => {
                              setAddMenuOpen(false);
                              document.getElementById("attachment_file")?.click();
                            }}
                          >
                            <Paperclip className="h-4 w-4 text-slate-500" /> Attachment
                          </button>
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        setAddMenuOpen(false);
                        checklistInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        setTimeout(() => checklistInputRef.current?.focus(), 200);
                      }}
                    >
                      <CheckSquare className="mr-1 h-4 w-4" /> Checklist
                    </Button>

                    <div className="relative shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setMembersMenuOpen((open) => !open);
                          setAddMenuOpen(false);
                        }}
                      >
                        <UserPlus className="mr-1 h-4 w-4" /> Members
                      </Button>
                      {membersMenuOpen && (
                        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
                          <p className="px-3 py-1.5 text-xs font-semibold uppercase text-slate-400">Anggota PO</p>
                          <div className="max-h-56 overflow-y-auto">
                            {allUsers.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Belum ada user.</p>}
                            {allUsers.map((user) => {
                              const isMember = (selectedPo.members ?? []).some((member) => member.user_id === user.id);
                              return (
                                <button
                                  type="button"
                                  key={user.id}
                                  onClick={() => toggleMember(selectedPo, user)}
                                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                                >
                                  <span className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-denim-600 text-[9px] font-bold text-white">
                                      {shortName(user.nama_lengkap)}
                                    </span>
                                    <span className="truncate">{user.nama_lengkap}</span>
                                  </span>
                                  {isMember && <CheckSquare className="h-4 w-4 shrink-0 text-thread-500" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <label className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium hover:bg-slate-50">
                      <Paperclip className="mr-1 h-4 w-4" /> Tambah Gambar
                      <input
                        id="attachment_file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          const file = event.target.files?.[0];
                          if (file) addPhotoAttachment(selectedPo, file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <Button type="button" variant="outline" className="shrink-0" onClick={() => setBarcodeOpen(true)}>
                      <Printer className="mr-1 h-4 w-4" /> Label PO
                    </Button>
                    {selectedPo.status !== CANCELLED_PO_STATUS && (
                      <>
                        <Button type="button" variant="outline" className="shrink-0" onClick={() => moveSelected(-1)}>
                          Mundur
                        </Button>
                        <Button type="button" variant="outline" className="shrink-0" onClick={() => moveSelected(1)}>
                          Maju
                        </Button>
                        <select
                          value={normalizeStage(selectedPo.status)}
                          onChange={(event) => updateStatus(selectedPo, event.target.value)}
                          className="h-11 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-sm sm:h-10"
                        >
                          {stageNames.map((stage) => (
                            <option key={stage} value={stage}>
                              {stage}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    {isAdmin && selectedPo.status !== CANCELLED_PO_STATUS && (
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                        disabled={cancelProcessingId === selectedPo.id}
                        onClick={() => cancelPo(selectedPo)}
                      >
                        <Ban className="mr-1 h-4 w-4" /> Batalkan PO
                      </Button>
                    )}
                    {isAdmin && selectedPo.status === CANCELLED_PO_STATUS && (
                      <>
                        <span className="flex h-11 shrink-0 items-center rounded-md bg-red-50 px-3 text-xs font-semibold uppercase text-red-600 ring-1 ring-red-200 sm:h-10">
                          PO dibatalkan
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0"
                          disabled={cancelProcessingId === selectedPo.id}
                          onClick={() => restorePo(selectedPo)}
                        >
                          <RotateCcw className="mr-1 h-4 w-4" /> Pulihkan
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                          disabled={cancelProcessingId === selectedPo.id}
                          onClick={() => deletePoPermanently(selectedPo)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Hapus Permanen
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold text-slate-500">Labels</p>
                      <div className="flex gap-2">
                        <input
                          ref={labelInputRef}
                          value={selectedPo.label ?? ""}
                          onChange={(event) => setSelectedPo({ ...selectedPo, label: event.target.value })}
                          onBlur={(event) => updatePoMeta(selectedPo, { label: event.target.value })}
                          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                          placeholder="Contoh: MILANO"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold text-slate-500">Due date</p>
                      <input
                        ref={dueDateInputRef}
                        type="datetime-local"
                        value={selectedPo.due_date ? selectedPo.due_date.slice(0, 16) : ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSelectedPo({ ...selectedPo, due_date: value ? new Date(value).toISOString() : null });
                          updatePoMeta(selectedPo, { due_date: value });
                        }}
                        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <ListChecks className="h-4 w-4" />
                        Checklist
                      </div>
                      {selectedPo.checklistItems?.length ? (
                        <span className="text-xs font-medium text-slate-500">
                          {selectedPo.checklistItems.filter((item) => item.is_done).length}/{selectedPo.checklistItems.length} selesai
                        </span>
                      ) : null}
                    </div>
                    {selectedPo.checklistItems?.length ? (
                      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-thread-500 transition-all"
                          style={{
                            width: `${Math.round(
                              (selectedPo.checklistItems.filter((item) => item.is_done).length / selectedPo.checklistItems.length) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    ) : null}
                    <div className="mb-3 space-y-1.5">
                      {selectedPo.checklistItems?.length ? (
                        selectedPo.checklistItems.map((item) => (
                          <div
                            key={item.id}
                            className="group flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={item.is_done}
                              onChange={() => toggleChecklistItem(selectedPo, item)}
                              className="h-4 w-4 shrink-0"
                            />
                            <span className={`flex-1 ${item.is_done ? "text-slate-400 line-through" : "text-slate-700"}`}>{item.text}</span>
                            <button
                              type="button"
                              onClick={() => deleteChecklistItem(selectedPo, item)}
                              className="shrink-0 text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                              title="Hapus item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">Belum ada item checklist</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={checklistInputRef}
                        value={checklistText}
                        onChange={(event) => setChecklistText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addChecklistItem(selectedPo);
                          }
                        }}
                        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                        placeholder="Tambah item checklist..."
                      />
                      <Button type="button" variant="outline" disabled={addingChecklist} onClick={() => addChecklistItem(selectedPo)}>
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <MoreHorizontal className="h-4 w-4" />
                      Description
                    </div>
                    <textarea
                      value={editingDescription || selectedPo.description || ""}
                      onFocus={() => setEditingDescription(selectedPo.description || "")}
                      onChange={(event) => setEditingDescription(event.target.value)}
                      onBlur={() => {
                        updatePoMeta(selectedPo, { description: editingDescription });
                        setEditingDescription("");
                      }}
                      className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Add a more detailed description..."
                    />
                  </div>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-md border border-slate-200 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Tag className="h-4 w-4" />
                        Detail Produksi
                      </div>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-500">Harga Satuan</dt>
                          <dd className="font-medium">Rp {selectedPo.harga_satuan.toLocaleString("id-ID")}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-500">Target QTY</dt>
                          <dd className="font-medium">{selectedPo.target_qty ?? "-"}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-500">Dibuat</dt>
                          <dd className="font-medium">{format(new Date(selectedPo.createdAt), "dd/MM/yyyy HH:mm")}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-md border border-slate-200 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Barcode className="h-4 w-4" />
                        Barcode
                      </div>
                      <div className="flex justify-center rounded bg-slate-50 px-3 py-2">
                        <OperatorBarcode value={selectedPo.barcode_po} height={46} width={1.8} fontSize={11} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Package className="h-4 w-4" />
                        Artikel dalam PO
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      {(selectedPo.articles?.length ? selectedPo.articles : [{ id: 0, nama_artikel: selectedPo.nama_artikel, harga_satuan: selectedPo.harga_satuan, qty: selectedPo.target_qty }]).map((article) => (
                        <div key={article.id} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
                          <span className="font-medium text-slate-700">{article.nama_artikel}</span>
                          <span className="text-slate-500">{article.qty ? `${article.qty} pcs` : "-"}</span>
                          <span className="font-medium">Rp {article.harga_satuan.toLocaleString("id-ID")}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Paperclip className="h-4 w-4" />
                        Attachments
                      </div>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium hover:bg-slate-50">
                        <Paperclip className="mr-1 h-4 w-4" /> Pilih Gambar
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            const file = event.target.files?.[0];
                            if (file) addPhotoAttachment(selectedPo, file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <span className="self-center text-xs text-slate-400">JPG, PNG, WebP · otomatis dikompres</span>
                    </div>
                    <div className="space-y-2">
                      {selectedPo.attachments?.length ? (
                        selectedPo.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.file_url}
                            target="_blank"
                            className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            <span className="font-medium text-slate-700">{attachment.file_name}</span>
                            <Link className="h-4 w-4 text-slate-400" />
                          </a>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">Belum ada attachment</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="min-w-0 border-t border-slate-200 bg-slate-50 p-6 lg:border-l lg:border-t-0">
                <h3 className="mb-4 text-sm font-semibold text-slate-800">Aktivitas dan Status</h3>
                <div className="rounded-md bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
                  <p className="mb-4 break-words">
                    {selectedPo.creator.nama_lengkap} membuat PO ini dan sekarang berada di tahap{" "}
                    <span className="font-semibold text-slate-900">{normalizeStage(selectedPo.status)}</span>.
                  </p>
                  <div className="space-y-3">
                    {selectedPo.activityLogs?.length ? (
                      selectedPo.activityLogs.slice(0, 12).map((log) => (
                        <div key={log.id} className="border-l-2 border-slate-200 pl-3">
                          <p className="break-words text-xs font-medium text-slate-800">{log.summary}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">{format(new Date(log.createdAt), "dd/MM/yyyy HH:mm")}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">Belum ada log aktivitas tambahan.</p>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PoBarcodeLabelsDialog open={barcodeOpen} onOpenChange={setBarcodeOpen} pos={selectedPo ? [selectedPo] : filteredPos} />

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none ring-0">
          <div className="relative flex min-h-[300px] w-full items-center justify-center">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-[90vh] w-auto max-w-full rounded-lg object-contain shadow-2xl ring-1 ring-white/20"
              />
            )}
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-4 -right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
              aria-label="Tutup preview"
            >
              <Plus className="h-6 w-6 rotate-45" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelledOpen} onOpenChange={setCancelledOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-600" /> PO Dibatalkan
            </DialogTitle>
            <DialogDescription>PO yang dibatalkan keluar dari board tapi datanya tetap tersimpan. Pulihkan kapan saja, atau hapus permanen bila memang sudah tidak diperlukan.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {cancelledPos.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Belum ada PO yang dibatalkan.</p>
            ) : (
              cancelledPos.map((po) => (
                <div key={po.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {po.nomor_po} - {po.nama_po}
                    </p>
                    <p className="truncate text-xs text-slate-500">{po.nama_artikel}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={cancelProcessingId === po.id}
                      onClick={() => restorePo(po)}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Pulihkan
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      disabled={cancelProcessingId === po.id}
                      onClick={() => deletePoPermanently(po)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      </main>
    </div>
  );
}
