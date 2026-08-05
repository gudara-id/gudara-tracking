"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Barcode, CalendarDays, CheckSquare, Circle, Link, MoreHorizontal, Package, Paperclip, Tag, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import InputProduksiModal from "@/components/InputProduksiModal";
import { KANBAN_PO_STATUSES } from "@/lib/validators";

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
};

const stageAccent: Record<string, string> = {
  "PRINT PO TINGKING": "bg-sky-500",
  "ANTRIAN PRINT RAJA PRINTING": "bg-indigo-500",
  "ANTRIAN PRESS": "bg-violet-500",
  "SELESAI PRESS": "bg-emerald-500",
  "PO EMBOSS": "bg-amber-500",
  "PROSES CUTTING": "bg-orange-500",
  "SIAP JAHIT": "bg-cyan-500",
  JAHIT: "bg-blue-500",
  "FINISHING / PACKING": "bg-fuchsia-500",
  "SIAP KIRIM": "bg-rose-500",
  TERKIRIM: "bg-slate-500",
};

function normalizeStage(status: string) {
  if (status === "selesai") return "TERKIRIM";
  if (status === "berjalan") return "SIAP JAHIT";
  return KANBAN_PO_STATUSES.includes(status as (typeof KANBAN_PO_STATUSES)[number]) ? status : "SIAP JAHIT";
}

function shortName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function ProduksiDashboardClient({ namaLengkap }: { namaLengkap: string }) {
  const router = useRouter();
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PO | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const fetchPos = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/po");
    if (res.ok) setPos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPos();
  }, [fetchPos]);

  const groupedPos = useMemo(() => {
    return KANBAN_PO_STATUSES.reduce<Record<string, PO[]>>((groups, stage) => {
      groups[stage] = pos.filter((po) => normalizeStage(po.status) === stage);
      return groups;
    }, {});
  }, [pos]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

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

  function moveSelected(direction: -1 | 1) {
    if (!selectedPo) return;
    const currentIndex = KANBAN_PO_STATUSES.indexOf(normalizeStage(selectedPo.status) as (typeof KANBAN_PO_STATUSES)[number]);
    const nextStage = KANBAN_PO_STATUSES[currentIndex + direction];
    if (nextStage) updateStatus(selectedPo, nextStage);
  }

  return (
    <main className="min-h-screen bg-[#eee7dc] text-slate-900">
      <div className="sticky top-0 z-20 border-b border-white/50 bg-[#eee7dc]/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wide text-slate-800">GUDARA Production Board</h1>
            <p className="text-xs text-slate-500">Halo, {namaLengkap} - {pos.length} PO aktif di board</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setModalOpen(true)}>+ Input Produksi</Button>
            <Button variant="outline" onClick={fetchPos}>
              Refresh
            </Button>
            <Button variant="outline" onClick={() => router.push("/konfigurasi")}>
              Konfigurasi
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Keluar
            </Button>
          </div>
        </div>
      </div>

      <section className="flex h-[calc(100vh-73px)] gap-3 overflow-x-auto px-3 py-4">
        {KANBAN_PO_STATUSES.map((stage) => (
          <div
            key={stage}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              const po = pos.find((item) => item.id === draggedId);
              if (po) updateStatus(po, stage);
            }}
            className="flex h-full w-[272px] shrink-0 flex-col rounded-lg bg-slate-100/90 shadow-sm ring-1 ring-black/5"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stageAccent[stage]}`} />
                <h2 className="truncate text-[11px] font-bold uppercase text-slate-700">{stage}</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{groupedPos[stage]?.length ?? 0}</span>
                <MoreHorizontal className="h-4 w-4" />
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {loading ? (
                <div className="rounded-md bg-white p-3 text-xs text-slate-400">Memuat...</div>
              ) : groupedPos[stage]?.length ? (
                groupedPos[stage].map((po) => (
                  <button
                    key={po.id}
                    draggable
                    onDragStart={() => setDraggedId(po.id)}
                    onClick={() => setSelectedPo(po)}
                    disabled={updatingId === po.id}
                    className="group w-full overflow-hidden rounded-md bg-white text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
                  >
                    <div className="flex h-24 items-center justify-center bg-[linear-gradient(135deg,#f8fafc_25%,#e2e8f0_25%,#e2e8f0_50%,#f8fafc_50%,#f8fafc_75%,#e2e8f0_75%)] bg-[length:18px_18px]">
                      <div className="rounded bg-white/90 px-3 py-2 text-xl font-black tracking-wide text-slate-700 shadow-sm">
                        {shortName(po.nama_artikel)}
                      </div>
                    </div>
                    <div className="space-y-2 p-2.5">
                      <div>
                        <div className="mb-1 h-1.5 w-10 rounded-full bg-red-500" />
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
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-400">
                  Kosong
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="border-t border-slate-200 px-3 py-2 text-left text-xs text-slate-500 hover:bg-white/70"
            >
              + Add a card
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

      <Dialog open={!!selectedPo} onOpenChange={(open) => !open && setSelectedPo(null)}>
        <DialogContent className="max-w-5xl p-0">
          {selectedPo && (
            <div className="grid max-h-[86vh] overflow-hidden lg:grid-cols-[1.35fr_0.85fr]">
              <div className="overflow-y-auto">
                <div className="flex h-40 items-center justify-center border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_25%,#e2e8f0_25%,#e2e8f0_50%,#f8fafc_50%,#f8fafc_75%,#e2e8f0_75%)] bg-[length:22px_22px]">
                  <div className="rounded bg-white/90 px-5 py-3 text-3xl font-black tracking-wide text-slate-700 shadow-sm">
                    {shortName(selectedPo.nama_artikel)}
                  </div>
                </div>
                <div className="p-6">
                  <DialogHeader>
                    <DialogTitle className="flex items-start gap-3 text-2xl">
                      <Circle className="mt-1 h-5 w-5 shrink-0" />
                      <span>
                        {selectedPo.nama_po} - {selectedPo.nama_artikel}
                        {selectedPo.target_qty ? ` - (${selectedPo.target_qty} PCS)` : ""}
                      </span>
                    </DialogTitle>
                    <DialogDescription>{selectedPo.nomor_po}</DialogDescription>
                  </DialogHeader>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button type="button" variant="outline">
                      + Add
                    </Button>
                    <Button type="button" variant="outline">
                      <CheckSquare className="mr-1 h-4 w-4" /> Checklist
                    </Button>
                    <Button type="button" variant="outline">
                      <UserPlus className="mr-1 h-4 w-4" /> Members
                    </Button>
                    <Button type="button" variant="outline" onClick={() => document.getElementById("attachment_url")?.focus()}>
                      <Paperclip className="mr-1 h-4 w-4" /> Attachment
                    </Button>
                    <Button type="button" variant="outline" onClick={() => moveSelected(-1)}>
                      Mundur
                    </Button>
                    <Button type="button" variant="outline" onClick={() => moveSelected(1)}>
                      Maju
                    </Button>
                    <select
                      value={normalizeStage(selectedPo.status)}
                      onChange={(event) => updateStatus(selectedPo, event.target.value)}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                    >
                      {KANBAN_PO_STATUSES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold text-slate-500">Labels</p>
                      <div className="flex gap-2">
                        <input
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
                      <p className="break-all rounded bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                        {selectedPo.barcode_po}
                      </p>
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
                    <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                      <input
                        value={attachmentName}
                        onChange={(event) => setAttachmentName(event.target.value)}
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                        placeholder="Nama file"
                      />
                      <input
                        id="attachment_url"
                        value={attachmentUrl}
                        onChange={(event) => setAttachmentUrl(event.target.value)}
                        className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                        placeholder="URL / path attachment"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!attachmentName || !attachmentUrl) {
                            toast.error("Nama dan URL attachment wajib diisi");
                            return;
                          }
                          updatePoMeta(selectedPo, { attachment: { file_name: attachmentName, file_url: attachmentUrl, is_cover: !selectedPo.attachments?.length } });
                          setAttachmentName("");
                          setAttachmentUrl("");
                        }}
                      >
                        Add
                      </Button>
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

              <aside className="border-t border-slate-200 bg-slate-50 p-6 lg:border-l lg:border-t-0">
                <h3 className="mb-4 text-sm font-semibold text-slate-800">Aktivitas dan Status</h3>
                <div className="rounded-md bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
                  <p>
                    {selectedPo.creator.nama_lengkap} membuat PO ini dan sekarang berada di tahap{" "}
                    <span className="font-semibold text-slate-900">{normalizeStage(selectedPo.status)}</span>.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
