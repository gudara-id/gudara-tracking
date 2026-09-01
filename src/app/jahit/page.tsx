import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

// Dashboard Jahit sekarang jadi tab di dalam halaman gabungan /produksi
// (role admin_jahit & admin_produksi sudah digabung jadi admin_operasional).
// Route ini dipertahankan supaya bookmark/link lama tetap jalan.
export default async function JahitPage() {
  const session = await getSession();
  if (!session) redirect("/");

  redirect("/produksi?tab=jahit");
}
