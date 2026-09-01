import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("gudara123", 10);

  const adminOperasional = await prisma.user.upsert({
    where: { username: "operasional" },
    update: {},
    create: {
      username: "operasional",
      password_hash: passwordHash,
      role: "admin_operasional",
      nama_lengkap: "Admin Operasional",
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
      created_by: adminOperasional.id,
    },
  });

  console.log("Seed selesai.");
  console.log("Login Admin Operasional -> username: operasional | password: gudara123");
  console.log("Contoh barcode operator: OP-0001, OP-0002, OP-0003");
  console.log("Contoh barcode PO: GDR-PO-2026080400001");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
