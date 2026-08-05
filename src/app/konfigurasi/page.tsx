import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import KonfigurasiClient from "./konfigurasi-client";


export default async function KonfigurasiPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "admin_produksi") redirect("/jahit");

  return <KonfigurasiClient namaLengkap={session.nama_lengkap} />;
}
