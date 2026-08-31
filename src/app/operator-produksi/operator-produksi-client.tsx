"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarDays, CheckSquare, ListChecks, Package, Square, Tag, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Sidebar from "@/components/Sidebar";

type ChecklistItem = { id: number; text: string; is_done: boolean; createdAt: string };
type Member = { id: number; user_id: number; nama_lengkap: string; username: string };

type PO = {
  id: number;
  nomor_po: string;
  nama_po: string;
  nama_artikel: string;
  target_qty: number | null;
  status: string;
  label: string | null;
  due_date: string | null;
  articles: { id: number; nama_artikel: string; qty: number | null }[];
  members: Member[];
  checklistItems: ChecklistItem[];
};

type StageRow = { id: number; nama: string; urutan: number };

const ACCENT_BORDERS = [
  "border-denim-600",
  "border-denim-500",
  "border-denim-400",
  "border-sky-500",
  "border-cyan-500",
  "border-thread-400",
  "border-thread-500",
  "border-thread-600",
  "border-emerald-500",
];

export default function OperatorProduksiClient({ namaLengkap }: { namaLengkap: string }) {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [selectedPo, setSelectedPo] = useState<PO | null>(null);

  const fetchAll = useCallback(async () => {
    const [stagesRes, poRes] = await Promise.all([fetch("/api/tahapan"), fetch("/api/po")]);
    if (stagesRes.ok) setStages(await stagesRes.json());
    if (poRes.ok) setPos(await poRes.json());
    else {
      const body = await poRes.json().catch(() => null);
      toast.error(body?.error || "Gagal memuat data PO");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const posByStage = useMemo(() => {
    const map = new Map<string, PO[]>();
    for (const po of pos) {
      const list = map.get(po.status) ?? [];
      list.push(po);
      map.set(po.status, list);
    }
    return map;
  }, [pos]);

  async function movePoToStage(poId: number, newStatus: string) {
    const po = pos.find((p) => p.id === poId);
    if (!po || po.status === newStatus) return;
    // Optimistic update supaya drag & drop terasa instan.
    setPos((prev) => prev.map((p) => (p.id === poId ? { ...p, status: newStatus } : p)));
    const res = await fetch("/api/po", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: poId, status: newStatus }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Gagal memindahkan PO");
      setPos((prev) => prev.map((p) => (p.id === poId ? { ...p, status: po.status } : p))); // rollback
      return;
    }
    const updated = await res.json();
    setPos((prev) => prev.map((p) => (p.id === poId ? { ...p, ...updated } : p)));
    setSelectedPo((prev) => (prev && prev.id === poId ? { ...prev, ...updated } : prev));
  }

  async function toggleChecklist(item: ChecklistItem) {
    if (!selectedPo) return;
    const res = await fetch("/api/po/checklist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, is_done: !item.is_done }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error || "Gagal mengubah checklist");
      return;
    }
    const updated: ChecklistItem = await res.json();
    setSelectedPo((prev) =>
      prev ? { ...prev, checklistItems: prev.checklistItems.map((c) => (c.id === updated.id ? updated : c)) } : prev
    );
    setPos((prev) =>
      prev.map((p) =>
        p.id === selectedPo.id ? { ...p, checklistItems: p.checklistItems.map((c) => (c.id === updated.id ? updated : c)) } : p
      )
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar fallbackName={namaLengkap} />
      <main className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-100 pb-24 text-slate-900 md:pb-0">
        <div className="sticky top-14 z-20 border-b border-dashed border-thread-300 bg-slate-100/95 px-4 py-3 backdrop-blur md:top-0">
          <h1 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-denim-800">
            <Package className="h-4 w-4 shrink-0" /> Board Produksi
          </h1>
          <p className="truncate text-xs text-slate-500">
            Halo, {namaLengkap} - geser kartu PO antar tahapan &amp; centang checklist tugas Anda
          </p>
        </div>

        {loading ? (
          <p className="px-4 py-16 text-center text-sm text-slate-400">Memuat board...</p>
        ) : (
          <div className="flex flex-1 gap-3 overflow-x-auto px-3 py-4">
            {stages.map((stage, idx) => {
              const accent = ACCENT_BORDERS[idx % ACCENT_BORDERS.length];
              const list = posByStage.get(stage.nama) ?? [];
              return (
                <div
                  key={stage.id}
                  className="flex w-72 shrink-0 flex-col rounded-lg bg-white/70 shadow-sm ring-1 ring-black/5"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedId) movePoToStage(draggedId, stage.nama);
                    setDraggedId(null);
                  }}
                >
                  <div className={`flex items-center justify-between rounded-t-lg border-b-2 ${accent} px-3 py-2`}>
                    <h2 className="truncate font-display text-[11px] font-bold uppercase text-slate-700">{stage.nama}</h2>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      {list.length}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2 p-2">
                    {list.length === 0 ? (
                      <p className="px-2 py-6 text-center text-xs text-slate-300">Kosong</p>
                    ) : (
                      list.map((po) => {
                        const doneCount = po.checklistItems.filter((c) => c.is_done).length;
                        return (
                          <div
                            key={po.id}
                            draggable
                            onDragStart={() => setDraggedId(po.id)}
                            onClick={() => setSelectedPo(po)}
                            className={`cursor-grab rounded-md border-l-4 ${accent} bg-white p-2.5 shadow-sm transition hover:shadow-md active:cursor-grabbing`}
                          >
                            <p className="truncate text-sm font-semibold text-slate-800">{po.nama_po}</p>
                            <p className="truncate text-[11px] text-slate-400">{po.nomor_po}</p>
                            {po.label && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-thread-50 px-2 py-0.5 text-[10px] font-medium text-thread-700">
                                <Tag className="h-2.5 w-2.5" /> {po.label}
                              </span>
                            )}
                            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                              {po.due_date ? (
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" /> {format(new Date(po.due_date), "dd/MM")}
                                </span>
                              ) : (
                                <span />
                              )}
                              {po.checklistItems.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <ListChecks className="h-3 w-3" /> {doneCount}/{po.checklistItems.length}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------- Detail PO: info dasar (read-only) + checklist (boleh centang) ---------- */}
        <Dialog open={!!selectedPo} onOpenChange={(open) => !open && setSelectedPo(null)}>
          <DialogContent className="max-w-lg">
            {selectedPo && (
              <>
                <DialogHeader>
                  <DialogTitle className="break-words">{selectedPo.nama_po}</DialogTitle>
                  <DialogDescription>{selectedPo.nomor_po}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{selectedPo.status}</span>
                    {selectedPo.due_date && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                        <CalendarDays className="h-3 w-3" /> {format(new Date(selectedPo.due_date), "dd MMM yyyy")}
                      </span>
                    )}
                  </div>

                  {selectedPo.articles.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Artikel</p>
                      <ul className="space-y-1">
                        {selectedPo.articles.map((a) => (
                          <li key={a.id} className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-sm">
                            <span className="truncate">{a.nama_artikel}</span>
                            {a.qty != null && <span className="shrink-0 text-xs text-slate-400">{a.qty} pcs</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedPo.members.length > 0 && (
                    <div>
                      <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-slate-400">
                        <Users className="h-3 w-3" /> Penanggung Jawab
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPo.members.map((m) => (
                          <span key={m.id} className="rounded-full bg-denim-50 px-2.5 py-1 text-xs font-medium text-denim-700">
                            {m.nama_lengkap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase text-slate-400">
                      <ListChecks className="h-3 w-3" /> Checklist
                    </p>
                    {selectedPo.checklistItems.length === 0 ? (
                      <p className="text-xs text-slate-400">Tidak ada checklist untuk PO ini.</p>
                    ) : (
                      <ul className="space-y-1">
                        {selectedPo.checklistItems.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => toggleChecklist(item)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                            >
                              {item.is_done ? (
                                <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                              ) : (
                                <Square className="h-4 w-4 shrink-0 text-slate-300" />
                              )}
                              <span className={item.is_done ? "text-slate-400 line-through" : "text-slate-700"}>{item.text}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Pindah Tahapan</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stages.map((stage) => (
                        <button
                          key={stage.id}
                          type="button"
                          disabled={stage.nama === selectedPo.status}
                          onClick={() => movePoToStage(selectedPo.id, stage.nama)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            stage.nama === selectedPo.status
                              ? "bg-denim-700 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-denim-100 hover:text-denim-700"
                          }`}
                        >
                          {stage.nama}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
