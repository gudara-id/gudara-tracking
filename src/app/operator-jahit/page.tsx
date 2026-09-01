import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import JahitDashboardClient from "../jahit/jahit-dashboard-client";


export default async function OperatorJahitPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "operator_jahit") redirect("/produksi");

  return <JahitDashboardClient namaLengkap={session.nama_lengkap} readOnly />;
}
