"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialsOf, type Profile } from "@/lib/profile";

export default function EditProfileModal({
  open,
  onOpenChange,
  profile,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  onSaved: (updated: Profile) => void;
}) {
  const [namaLengkap, setNamaLengkap] = useState(profile.nama_lengkap);
  const [email, setEmail] = useState(profile.email ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [saving, setSaving] = useState(false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      toast.error("Ukuran foto maksimal 1MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama_lengkap: namaLengkap, email, avatar_url: avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memperbarui profil");
        return;
      }
      toast.success("Profil diperbarui");
      onSaved(data);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profil</DialogTitle>
          <DialogDescription>Perbarui informasi akun yang sedang kamu gunakan.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-lg font-semibold text-white">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Foto profil" className="h-full w-full object-cover" />
              ) : (
                initialsOf(namaLengkap || profile.username)
              )}
            </div>
            <div>
              <Label htmlFor="avatar-upload" className="cursor-pointer text-sm text-slate-600 underline">
                Ganti foto
              </Label>
              <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl("")}
                  className="block text-xs text-red-600 hover:underline"
                >
                  Hapus foto
                </button>
              )}
            </div>
          </div>

          <div>
            <Label>Nama Lengkap</Label>
            <Input value={namaLengkap} onChange={(e) => setNamaLengkap(e.target.value)} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
          </div>
          <div>
            <Label>Username</Label>
            <Input value={profile.username} disabled className="bg-slate-50 text-slate-500" />
            <p className="mt-1 text-xs text-slate-400">Username dipakai untuk login dan tidak dapat diubah sendiri. Hubungi Admin Operasional jika perlu diganti.</p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
