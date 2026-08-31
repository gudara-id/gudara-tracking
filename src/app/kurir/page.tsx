import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import KurirClient from "./kurir-client";

export default async function KurirPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return <KurirClient namaLengkap={session.nama_lengkap} />;
}
