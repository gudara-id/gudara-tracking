import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AnalitikDashboardClient from "./analitik-dashboard-client";

export default async function AnalitikPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "admin_produksi") redirect(session.role === "operator_jahit" ? "/operator-jahit" : "/jahit");

  return <AnalitikDashboardClient namaLengkap={session.nama_lengkap} />;
}
