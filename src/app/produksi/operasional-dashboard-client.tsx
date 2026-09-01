"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Scissors } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ProduksiDashboardClient from "./produksi-dashboard-client";
import JahitDashboardClient from "../jahit/jahit-dashboard-client";

type Tab = "produksi" | "jahit";

export default function OperasionalDashboardClient({ namaLengkap, role }: { namaLengkap: string; role: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get("tab") === "jahit" ? "jahit" : "produksi";
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const fromUrl = searchParams.get("tab") === "jahit" ? "jahit" : "produksi";
    setTab(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTab(next: Tab) {
    setTab(next);
    const url = next === "jahit" ? "/produksi?tab=jahit" : "/produksi";
    router.replace(url, { scroll: false });
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar fallbackName={namaLengkap} />
      <main className="min-h-screen min-w-0 flex-1 bg-slate-100 pb-24 text-slate-900 md:pb-0">
        <div className="sticky top-14 z-30 flex gap-1 border-b border-dashed border-thread-300 bg-slate-100/95 px-4 pt-3 backdrop-blur md:top-0">
          <button
            type="button"
            onClick={() => selectTab("produksi")}
            className={`flex items-center gap-2 rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "produksi"
                ? "border-thread-300 bg-white text-denim-800"
                : "border-transparent text-slate-500 hover:text-denim-700"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" /> Board Produksi
          </button>
          <button
            type="button"
            onClick={() => selectTab("jahit")}
            className={`flex items-center gap-2 rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "jahit"
                ? "border-thread-300 bg-white text-denim-800"
                : "border-transparent text-slate-500 hover:text-denim-700"
            }`}
          >
            <Scissors className="h-4 w-4" /> Dashboard Jahit
          </button>
        </div>

        <div className={tab === "produksi" ? "block" : "hidden"}>
          <ProduksiDashboardClient namaLengkap={namaLengkap} role={role} embedded />
        </div>
        <div className={tab === "jahit" ? "block" : "hidden"}>
          <JahitDashboardClient namaLengkap={namaLengkap} embedded />
        </div>
      </main>
    </div>
  );
}
