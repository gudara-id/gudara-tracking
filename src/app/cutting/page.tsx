import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import CuttingDashboardClient from "./cutting-dashboard-client";

export default async function CuttingPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return <CuttingDashboardClient namaLengkap={session.nama_lengkap} />;
}
