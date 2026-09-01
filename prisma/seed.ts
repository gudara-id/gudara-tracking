import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("gudara123", 10);

  const adminProduksi = await prisma.user.upsert({
    where: { username: "produksi" },
    update: {},
    create: {
      username: "produksi",
      password_hash: passwordHash,
      role: "admin_produksi",
      nama_lengkap: "Admin Produksi",
    },
  });

  const adminJahit = await prisma.user.upsert({
    where: { username: "jahit" },
    update: {},
    create: {
      username: "jahit",
      password_hash: passwordHash,
      role: "admin_jahit",
      nama_lengkap: "Admin Jahit",
    },
  });

  const adminCutting = await prisma.user.upsert({
    where: { username: "cutting" },
    update: {},
    create: {
      username: "cutting",
      password_hash: passwordHash,
      role: "admin_cutting",
      nama_lengkap: "Admin Cutting",
    },
  });

  const operators = [
    { barcode_operator: "OP-0001", nama_operator: "Siti Rahayu" },
    { barcode_operator: "OP-0002", nama_operator: "Dewi Lestari" },
    { barcode_operator: "OP-0003", nama_operator: "Ani Kurniawati" },
  ];
  for (const op of operators) {
    await prisma.operator.upsert({
      where: { barcode_operator: op.barcode_operator },
      update: {},
      create: { ...op, status: "aktif" },
    });
  }

  await prisma.purchaseOrder.upsert({
    where: { barcode_po: "GDR-PO-2026080400001" },
    update: {},
    create: {
      nomor_po: "PO-20260804-0001",
      barcode_po: "GDR-PO-2026080400001",
      nama_po: "Jersey Embos Variasi Lengan Panjang",
      nama_artikel: "Jersey Embos",
      harga_satuan: 8500,
      target_qty: 300,
      status: "berjalan",
      created_by: adminProduksi.id,
    },
  });

  console.log("Seed selesai.");
  console.log("Login Admin Produksi -> username: produksi | password: gudara123");
  console.log("Login Admin Jahit    -> username: jahit    | password: gudara123");
  console.log("Login Admin Cutting  -> username: cutting  | password: gudara123");
  console.log("Contoh barcode operator: OP-0001, OP-0002, OP-0003");
  console.log("Contoh barcode PO: GDR-PO-2026080400001");
  void adminJahit;
  void adminCutting;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
