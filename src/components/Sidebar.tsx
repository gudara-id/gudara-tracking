"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ChevronLeft, ChevronRight, KeyRound, LayoutDashboard, LogOut, PackageCheck, Scissors, Settings, ShoppingCart, Truck, UserCog, Wallet, X } from "lucide-react";
import { initialsOf, ROLE_LABELS, type Profile } from "@/lib/profile";
import EditProfileModal from "./EditProfileModal";
import ChangePasswordModal from "./ChangePasswordModal";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const NAV_BY_ROLE: Record<Profile["role"], NavItem[]> = {
  admin_produksi: [
    { href: "/produksi", label: "Board Produksi", icon: LayoutDashboard },
    { href: "/order", label: "Order", icon: ShoppingCart },
    { href: "/analitik", label: "Analitik", icon: BarChart3 },
    { href: "/payroll", label: "Payroll", icon: Wallet },
    { href: "/konfigurasi", label: "Konfigurasi", icon: Settings },
  ],
  admin_jahit: [
    { href: "/jahit", label: "Dashboard Jahit", icon: Scissors },
    { href: "/payroll", label: "Payroll", icon: Wallet },
  ],
  operator_jahit: [
    { href: "/operator-jahit", label: "Dashboard Saya", icon: Scissors },
    { href: "/gaji-saya", label: "Gaji Saya", icon: Wallet },
  ],
  operator_produksi: [{ href: "/operator-produksi", label: "Board Produksi", icon: PackageCheck }],
  kurir: [{ href: "/kurir", label: "Pengiriman", icon: Truck }],
  sales: [{ href: "/order", label: "Order", icon: ShoppingCart }],
};

export default function Sidebar({ fallbackName }: { fallbackName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) setProfile(await res.json());
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const displayName = profile?.nama_lengkap || fallbackName;
  const navItems = profile ? NAV_BY_ROLE[profile.role] : [];

  return (
    <>
    {/* ---------- Mobile top app bar (sticky, native-app style) ---------- */}
    <header className="pt-safe sticky top-0 z-30 flex h-14 items-center justify-between border-b border-denim-950 bg-denim-900 px-4 text-white md:hidden">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-thread-400 font-display text-xs font-bold text-denim-950">
          GD
        </span>
        <span className="font-display text-sm font-bold uppercase tracking-wide text-white">Gudara</span>
      </div>
      <button
        type="button"
        onClick={() => setProfileSheetOpen(true)}
        className="tap-shrink flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-thread-400 text-xs font-semibold text-denim-950"
        aria-label="Buka menu profil"
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
        ) : (
          initialsOf(displayName)
        )}
      </button>
    </header>

    {/* ---------- Mobile bottom tab bar ---------- */}
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white shadow-[0_-2px_10px_rgba(15,23,42,0.06)] md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => router.push(item.href)}
            className={`tap-shrink flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${
              active ? "text-denim-700" : "text-slate-400"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "text-thread-500" : ""}`} />
            {item.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setProfileSheetOpen(true)}
        className={`tap-shrink flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${
          profileSheetOpen ? "text-denim-700" : "text-slate-400"
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[9px] font-semibold text-slate-700">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            initialsOf(displayName)
          )}
        </span>
        Profil
      </button>
    </nav>

    {/* ---------- Mobile profile bottom sheet ---------- */}
    {profileSheetOpen && (
      <button
        type="button"
        aria-label="Tutup menu profil"
        className="fixed inset-0 z-40 bg-slate-950/45 md:hidden"
        onClick={() => setProfileSheetOpen(false)}
      />
    )}
    <div
      className={`pb-safe fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-denim-900 text-slate-100 shadow-2xl transition-transform duration-200 md:hidden ${
        profileSheetOpen ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-dashed border-thread-400/40 px-5 pb-4 pt-3">
        <span className="mx-auto h-1 w-10 rounded-full bg-denim-700 md:hidden" />
        <button type="button" className="absolute right-4 top-3 rounded-md p-1 text-denim-200 hover:bg-denim-800 hover:text-white" onClick={() => setProfileSheetOpen(false)} aria-label="Tutup">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-5 pb-6 pt-1">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-thread-400 text-base font-semibold text-denim-950">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              initialsOf(displayName)
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{displayName}</p>
            <p className="truncate text-xs text-denim-300">{profile ? ROLE_LABELS[profile.role] : ""}</p>
          </div>
        </div>

        <div className="mb-4 space-y-0.5 rounded-md bg-denim-950/60 px-3 py-2 text-xs">
          <p className="uppercase tracking-wide text-denim-400">Akun Login</p>
          <p className="truncate text-denim-100">
            Username: <span className="font-medium">{profile?.username ?? "-"}</span>
          </p>
          <p className="truncate text-denim-100">
            Email: <span className="font-medium">{profile?.email || "Belum diatur"}</span>
          </p>
        </div>

        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              setProfileSheetOpen(false);
              setEditOpen(true);
            }}
            className="tap-shrink flex w-full items-center gap-2 rounded-md px-2 py-3 text-left text-sm text-denim-200 hover:bg-denim-800 hover:text-white"
          >
            <UserCog className="h-4 w-4 shrink-0" /> Edit Profil
          </button>
          <button
            type="button"
            onClick={() => {
              setProfileSheetOpen(false);
              setPasswordOpen(true);
            }}
            className="tap-shrink flex w-full items-center gap-2 rounded-md px-2 py-3 text-left text-sm text-denim-200 hover:bg-denim-800 hover:text-white"
          >
            <KeyRound className="h-4 w-4 shrink-0" /> Ubah Password
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="tap-shrink flex w-full items-center gap-2 rounded-md px-2 py-3 text-left text-sm text-red-400 hover:bg-red-950/50 hover:text-red-300"
          >
            <LogOut className="h-4 w-4 shrink-0" /> Keluar
          </button>
        </div>
      </div>
    </div>

    {/* ---------- Desktop sidebar (unchanged layout, own nav) ---------- */}
    <aside
      className={`sticky top-0 z-auto hidden h-screen shrink-0 flex-col border-r border-denim-950 bg-denim-900 text-slate-100 transition-[width] duration-200 md:flex ${
        collapsed ? "md:w-20" : "md:w-64"
      }`}
    >
      <div className="border-b border-dashed border-thread-400/40 px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex items-center gap-2.5 ${collapsed ? "md:hidden" : ""}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-thread-400 font-display text-sm font-bold text-denim-950">
              GD
            </span>
            <span>
              <p className="font-display text-sm font-bold uppercase tracking-wide text-white">Gudara</p>
              <p className="text-[11px] text-denim-200">Production &amp; Sewing Tracker</p>
            </span>
          </div>
          <span className={`hidden h-9 w-9 items-center justify-center rounded-md bg-thread-400 font-display text-sm font-bold text-denim-950 ${collapsed ? "md:flex" : ""}`}>
            GD
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="mx-3 mt-3 hidden h-9 items-center justify-center gap-2 rounded-md border border-denim-800 text-xs font-medium text-denim-200 hover:bg-denim-800 hover:text-white md:flex"
        aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
        title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {!collapsed && "Tutup"}
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              title={collapsed ? item.label : undefined}
              className={`flex w-full items-center gap-2 rounded-md border-l-2 px-3 py-2 text-left text-sm transition-colors ${
                active
                  ? "border-thread-400 bg-denim-800 font-medium text-white"
                  : "border-transparent text-denim-200 hover:bg-denim-800/60 hover:text-white"
              } ${collapsed ? "md:justify-center md:border-l-0 md:px-2" : ""}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-thread-300" : ""}`} />
              <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-dashed border-thread-400/40 p-4">
        <div className={`mb-3 flex items-center gap-3 ${collapsed ? "md:justify-center" : ""}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-thread-400 text-sm font-semibold text-denim-950">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              initialsOf(displayName)
            )}
          </span>
          <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="truncate text-xs text-denim-300">{profile ? ROLE_LABELS[profile.role] : ""}</p>
          </div>
        </div>

        <div className={`mb-3 space-y-0.5 rounded-md bg-denim-950/60 px-3 py-2 text-xs ${collapsed ? "md:hidden" : ""}`}>
          <p className="uppercase tracking-wide text-denim-400">Akun Login</p>
          <p className="truncate text-denim-100">
            Username: <span className="font-medium">{profile?.username ?? "-"}</span>
          </p>
          <p className="truncate text-denim-100">
            Email: <span className="font-medium">{profile?.email || "Belum diatur"}</span>
          </p>
        </div>

        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            title={collapsed ? "Edit Profil" : undefined}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-denim-200 hover:bg-denim-800 hover:text-white ${collapsed ? "md:justify-center" : ""}`}
          >
            <UserCog className="h-3.5 w-3.5 shrink-0" /> <span className={collapsed ? "md:hidden" : ""}>Edit Profil</span>
          </button>
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            title={collapsed ? "Ubah Password" : undefined}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-denim-200 hover:bg-denim-800 hover:text-white ${collapsed ? "md:justify-center" : ""}`}
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0" /> <span className={collapsed ? "md:hidden" : ""}>Ubah Password</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Keluar" : undefined}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-red-400 hover:bg-red-950/50 hover:text-red-300 ${collapsed ? "md:justify-center" : ""}`}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" /> <span className={collapsed ? "md:hidden" : ""}>Keluar</span>
          </button>
        </div>
      </div>

      {profile && (
        <>
          <EditProfileModal open={editOpen} onOpenChange={setEditOpen} profile={profile} onSaved={(updated) => setProfile(updated)} />
          <ChangePasswordModal open={passwordOpen} onOpenChange={setPasswordOpen} />
        </>
      )}
    </aside>
    </>
  );
}
