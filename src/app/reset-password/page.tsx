"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Konfirmasi password tidak sama");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal reset password");
        return;
      }
      toast.success(data.message || "Password berhasil direset");
      router.push("/");
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-denim-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl shadow-black/40">
        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-denim-800 font-display text-sm font-bold text-thread-300">
          GD
        </span>
        <h1 className="mb-1 font-display text-xl font-bold text-slate-900">Reset Password</h1>
        <p className="mb-6 text-sm text-slate-500">Masukkan password baru untuk akun Gudara Tracker.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password baru</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Konfirmasi password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <Button type="submit" disabled={loading || !token} className="mt-2 w-full">
            {loading ? "Memproses..." : "Reset Password"}
          </Button>
          {!token && <p className="text-sm text-red-600">Token reset tidak ditemukan di URL.</p>}
        </form>
      </div>
    </main>
  );
}
