"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login gagal");
        return;
      }
      toast.success("Login berhasil");
      router.push(data.redirectTo);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setDevResetUrl("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memproses reset password");
        return;
      }
      toast.success(data.message || "Jika email terdaftar, link reset akan dikirim");
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pt-safe pb-safe flex min-h-screen items-center justify-center bg-denim-950 px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl shadow-black/40 lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel — signature stitched seam pattern, hidden on small screens */}
        <div className="relative hidden flex-col justify-between bg-denim-900 p-10 text-white lg:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(115deg, transparent, transparent 22px, rgba(219,166,53,0.9) 22px, rgba(219,166,53,0.9) 24px)",
            }}
          />
          <div className="relative">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-thread-400 font-display text-base font-bold text-denim-950">
              GD
            </span>
            <h1 className="mt-6 font-display text-3xl font-bold leading-tight">
              Gudara
              <br />
              Tracker
            </h1>
            <p className="mt-3 max-w-[26ch] text-sm text-denim-200">
              Satu jalur, dari potong kain sampai kirim: pantau setiap PO dan setoran jahit di satu tempat.
            </p>
          </div>
          <div className="relative border-t border-dashed border-thread-400/50 pt-4 text-xs text-denim-300">
            Produksi &middot; Jahit &middot; Payroll operator
          </div>
        </div>

        {/* Form panel */}
        <div className="bg-white p-8 sm:p-10">
          <div className="mb-6 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-denim-800 font-display text-sm font-bold text-thread-300">
              GD
            </span>
          </div>
          <h2 className="mb-1 font-display text-xl font-bold text-slate-900">
            {forgotMode ? "Reset password" : "Masuk ke akun kamu"}
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            {forgotMode ? "Kami akan kirim link reset ke email akun kamu" : "Gudara Production & Sewing Tracker"}
          </p>

        {forgotMode ? (
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email akun</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
            </div>
            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? "Memproses..." : "Kirim Link Reset"}
            </Button>
            {devResetUrl && (
              <a href={devResetUrl} className="break-all rounded-md bg-thread-50 p-3 text-xs font-medium text-thread-700">
                Link reset development: {devResetUrl}
              </a>
            )}
            <button
              type="button"
              onClick={() => setForgotMode(false)}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Kembali ke login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? "Memproses..." : "Masuk"}
            </Button>
            <button
              type="button"
              onClick={() => setForgotMode(true)}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Lupa password?
            </button>
          </form>
        )}
        </div>
      </div>
    </main>
  );
}
