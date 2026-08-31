import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import OrderDashboardClient from "./order-dashboard-client";

export default async function OrderPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "sales") {
    redirect(session.role === "operator_jahit" ? "/operator-jahit" : "/jahit");
  }

  return <OrderDashboardClient namaLengkap={session.nama_lengkap} role={session.role} />;
}
