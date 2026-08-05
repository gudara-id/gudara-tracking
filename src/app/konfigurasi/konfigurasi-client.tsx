"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Database, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Artikel = { id: number; kode_artikel: string | null; nama_artikel: string; harga_satuan: number; status: string };
type UserRow = { id: number; username: string; role: string; nama_lengkap: string; createdAt: string };

export default function KonfigurasiClient({ namaLengkap }: { namaLengkap: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"artikel" | "user" | "lainnya">("artikel");
  const [artikels, setArtikels] = useState<Artikel[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [artikelForm, setArtikelForm] = useState({ kode_artikel: "", nama_artikel: "", harga_satuan: "" });
  const [userForm, setUserForm] = useState({ username: "", password: "", role: "admin_jahit", nama_lengkap: "" });

  const fetchConfig = useCallback(async () => {
    const [artikelRes, userRes] = await Promise.all([fetch("/api/artikel"), fetch("/api/users")]);
    if (artikelRes.ok) setArtikels(await artikelRes.json());
    if (userRes.ok) setUsers(await userRes.json());
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
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
    setArtikelForm({ kode_artikel: "", nama_artikel: "", harga_satuan: "" });
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
    setUserForm({ username: "", password: "", role: "admin_jahit", nama_lengkap: "" });
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Konfigurasi</h1>
          <p className="text-sm text-slate-500">Halo, {namaLengkap} - database artikel, user, dan pengaturan operasional</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push("/produksi")}>Board Produksi</Button>
          <Button variant="outline" onClick={handleLogout}>Keluar</Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ["artikel", "Database Artikel"],
          ["user", "User"],
          ["lainnya", "Konfigurasi Lainnya"],
        ].map(([key, label]) => (
          <Button key={key} variant={activeTab === key ? "default" : "outline"} onClick={() => setActiveTab(key as typeof activeTab)}>
            {label}
          </Button>
        ))}
      </div>

      {activeTab === "artikel" && (
        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <form onSubmit={addArtikel} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
              <Database className="h-4 w-4" /> Input Database Artikel
            </div>
            <div className="space-y-3">
              <div>
                <Label>Kode Artikel</Label>
                <Input value={artikelForm.kode_artikel} onChange={(e) => setArtikelForm({ ...artikelForm, kode_artikel: e.target.value })} placeholder="Opsional" />
              </div>
              <div>
                <Label>Nama Artikel</Label>
                <Input value={artikelForm.nama_artikel} onChange={(e) => setArtikelForm({ ...artikelForm, nama_artikel: e.target.value })} required />
              </div>
              <div>
                <Label>Harga Satuan</Label>
                <Input type="number" min="1" value={artikelForm.harga_satuan} onChange={(e) => setArtikelForm({ ...artikelForm, harga_satuan: e.target.value })} required />
              </div>
              <Button type="submit" className="w-full">Tambah Artikel</Button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Artikel</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artikels.map((artikel) => (
                  <TableRow key={artikel.id}>
                    <TableCell>{artikel.kode_artikel ?? "-"}</TableCell>
                    <TableCell className="font-medium">{artikel.nama_artikel}</TableCell>
                    <TableCell>Rp {artikel.harga_satuan.toLocaleString("id-ID")}</TableCell>
                    <TableCell>{artikel.status}</TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" onClick={() => deleteArtikel(artikel.id)}>
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

      {activeTab === "user" && (
        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <form onSubmit={addUser} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
              <UserPlus className="h-4 w-4" /> Add User
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
                <Label>Password</Label>
                <Input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
              </div>
              <div>
                <Label>Role</Label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm">
                  <option value="admin_jahit">Admin Jahit</option>
                  <option value="operator_jahit">Operator Jahit</option>
                  <option value="admin_produksi">Admin Produksi</option>
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
                  <TableHead>Role</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.nama_lengkap}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>
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

      {activeTab === "lainnya" && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-900">Kebutuhan Konfigurasi Lainnya</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-sm font-medium">Stage Kanban</p>
              <p className="mt-1 text-xs text-slate-500">Tahapan produksi dapat dikembangkan menjadi tabel master jika dibutuhkan.</p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-sm font-medium">Role Akses</p>
              <p className="mt-1 text-xs text-slate-500">Saat ini tersedia admin_produksi dan admin_jahit.</p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-sm font-medium">Backup Database</p>
              <p className="mt-1 text-xs text-slate-500">Untuk SQLite lokal, file database berada di prisma/dev.db.</p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
