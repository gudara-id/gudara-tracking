import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import JahitDashboardClient from "./jahit-dashboard-client";


export default async function JahitPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return <JahitDashboardClient namaLengkap={session.nama_lengkap} />;
}
