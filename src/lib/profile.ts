export type Profile = {
  id: number;
  username: string;
  email: string | null;
  role: "admin_operasional" | "operator_jahit" | "operator_produksi" | "kurir" | "sales";
  nama_lengkap: string;
  avatar_url: string | null;
  createdAt: string;
};

export const ROLE_LABELS: Record<Profile["role"], string> = {
  admin_operasional: "Admin Operasional",
  operator_jahit: "Operator Jahit",
  operator_produksi: "Operator Produksi",
  kurir: "Kurir",
  sales: "Sales",
};

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
