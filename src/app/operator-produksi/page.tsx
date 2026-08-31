import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import OperatorProduksiClient from "./operator-produksi-client";

export default async function OperatorProduksiPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return <OperatorProduksiClient namaLengkap={session.nama_lengkap} />;
}
