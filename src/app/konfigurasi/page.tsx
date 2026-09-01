import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import KonfigurasiClient from "./konfigurasi-client";


export default async function KonfigurasiPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (!["admin_operasional", "sales"].includes(session.role)) redirect("/produksi");

  return <KonfigurasiClient namaLengkap={session.nama_lengkap} role={session.role} />;
}
