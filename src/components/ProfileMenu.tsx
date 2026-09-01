"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Settings, UserCog } from "lucide-react";
import { initialsOf, ROLE_LABELS, type Profile } from "@/lib/profile";
import EditProfileModal from "./EditProfileModal";
import ChangePasswordModal from "./ChangePasswordModal";

export default function ProfileMenu({ fallbackName }: { fallbackName: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) setProfile(await res.json());
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const displayName = profile?.nama_lengkap || fallbackName;
  const roleLabel = profile ? ROLE_LABELS[profile.role] : "";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-300 bg-white py-1 pl-1 pr-3 text-sm hover:bg-slate-50"
      >
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-xs font-semibold text-white">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            initialsOf(displayName)
          )}
        </span>
        <span className="hidden max-w-[120px] truncate font-medium text-slate-800 sm:inline">{displayName}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-base font-semibold text-white">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                initialsOf(displayName)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{roleLabel}</p>
            </div>
          </div>

          <div className="space-y-1 border-b border-slate-100 py-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Akun Login</p>
            <p className="text-slate-700">
              Username: <span className="font-medium">{profile?.username ?? "-"}</span>
            </p>
            <p className="text-slate-700">
              Email: <span className="font-medium">{profile?.email || "Belum diatur"}</span>
            </p>
          </div>

          <div className="space-y-1 py-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <UserCog className="h-4 w-4" /> Edit Profil
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPasswordOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <KeyRound className="h-4 w-4" /> Ubah Password
            </button>
            {profile?.role === "admin_operasional" && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/konfigurasi");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Settings className="h-4 w-4" /> Konfigurasi
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Keluar
            </button>
          </div>
        </div>
      )}

      {profile && (
        <>
          <EditProfileModal
            open={editOpen}
            onOpenChange={setEditOpen}
            profile={profile}
            onSaved={(updated) => setProfile(updated)}
          />
          <ChangePasswordModal open={passwordOpen} onOpenChange={setPasswordOpen} />
        </>
      )}
    </div>
  );
}
