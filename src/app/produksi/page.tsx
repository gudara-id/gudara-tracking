import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProduksiDashboardClient from "./produksi-dashboard-client";


export default async function ProduksiPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return <ProduksiDashboardClient namaLengkap={session.nama_lengkap} role={session.role} />;
}
