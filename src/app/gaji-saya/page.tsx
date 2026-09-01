import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import GajiSayaClient from "./gaji-saya-client";

export default async function GajiSayaPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "operator_jahit") redirect("/produksi");

  return <GajiSayaClient namaLengkap={session.nama_lengkap} />;
}
