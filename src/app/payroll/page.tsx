import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PayrollDashboardClient from "./payroll-dashboard-client";

export default async function PayrollPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role === "operator_jahit") redirect("/operator-jahit");

  return <PayrollDashboardClient namaLengkap={session.nama_lengkap} />;
}
