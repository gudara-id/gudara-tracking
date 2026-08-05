const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TANGGAL = new Date("2026-08-01T00:00:00Z");

// { operator, item, qty, harga }
const ROWS = [
  // IWENG
  ["IWENG", "EMBOS LENGAN PENDEK W", 64, 6500],
  ["IWENG", "EMBOS LENGAN PENDEK V", 27, 6500],
  ["IWENG", "EMBOS LENGAN PANJANG", 27, 7500],
  ["IWENG", "EMBOS SETELAN ANAK", 53, 10000],
  ["IWENG", "EMBOS KERAH RIB", 37, 6500],
  ["IWENG", "EMBOS SINGLET", 3, 5500],
  ["IWENG", "JERSEY RETRO", 1, 6500],
  ["IWENG", "JERSEY RUNNING", 1, 6500],
  ["IWENG", "MBGT 2026 TAMBAHAN", 1, 8500],
  // UJANG
  ["UJANG", "SAMPLE AIRWALK", 1, 50000],
  ["UJANG", "SAMPLE RIB", 1, 50000],
  ["UJANG", "JAMBORE WANGKI", 52, 6500],
  ["UJANG", "EMBOS LENGAN PANJANG", 18, 7500],
  ["UJANG", "SAMPLE", 1, 50000],
  // TEAM ACEP
  ["TEAM ACEP", "TAPAK SUCI SETELAN ANAK", 120, 5500],
  ["TEAM ACEP", "TAPAK SUCI OBLONG", 106, 3500],
  ["TEAM ACEP", "EMBOS KERAH RIB", 74, 6500],
  ["TEAM ACEP", "EMBOS SETELAN ANAK", 34, 10000],
  ["TEAM ACEP", "JAMBORE PENDEK", 145, 6500],
  ["TEAM ACEP", "JAMBORE PANJANG", 10, 7000],
  ["TEAM ACEP", "MASTERZONE-5 PANJANG", 2, 8000],
  ["TEAM ACEP", "MASTERZONE-5 PENDEK", 2, 10000],
  ["TEAM ACEP", "TAEKWONDO ACADEMY TANJUNG", 1, 8000],
  ["TEAM ACEP", "TAEKWONDO FIGHTER TABAHAN", 3, 8000],
  // DULL
  ["DULL", "EMBOS SINGLET", 10, 5500],
  ["DULL", "EMBOS SETELAN ANAK", 20, 10000],
  ["DULL", "EMBOS STRIP", 1, 6500],
  ["DULL", "EMBOS LENGAN PENDEK", 29, 6500],
  ["DULL", "EMBOS LENGAN PANJANG", 20, 7500],
  ["DULL", "OKA JAPAN-2", 12, 6500],
  ["DULL", "FTPI", 24, 6500],
  ["DULL", "EMBOS VARIASI 21-07 SETELAN ANAK", 26, 10000],
  // AAP
  ["AAP", "EMBOS LENGAN PENDEK", 19, 6500],
  ["AAP", "TAPAK SUCI OBLONG", 49, 3500],
  ["AAP", "EMBOS SETELAN ANAK", 28, 10000],
  // A IVAN
  ["A IVAN", "CUTTING TAPAK SUCI WANGKI", 130, 1000],
  ["A IVAN", "CUTTING TAPAK SUCI OBLONG", 155, 1000],
  ["A IVAN", "CUTTING WAFFLE STRIPE HITAM", 128, 1000],
  ["A IVAN", "CUTTING EMBOS SETELAN ANAK", 54, 1300],
  ["A IVAN", "CUTTING EMBOS SETELAN ANAK", 54, 1300],
  ["A IVAN", "CUTTING EMBOS HITAM", 110, 1000],
  ["A IVAN", "CUTTING EMBOS HITAM", 51, 1000],
  ["A IVAN", "CUTTING EMBOS PUTIH", 54, 1000],
  ["A IVAN", "CUTTING CELANA DESA KERTAHAJA", 30, 2000],
  // MANG AJAT
  ["MANG AJAT", "TAPAK SUCI SETELAN ANAK", 180, 5500],
  ["MANG AJAT", "TAPAK SUCI WANGKI", 77, 6500],
  ["MANG AJAT", "JERSEY RUNNING STOK", 14, 8000],
  ["MANG AJAT", "EMBOS LENGAN PANJANG", 26, 7500],
  ["MANG AJAT", "CELANA TRAINING DESA KERTAHARJA", 17, 18000],
  // ROFI
  ["ROFI", "TAPAK SUCI WANGKI", 29, 6500],
  ["ROFI", "EMBOS LENGAN PENDEK", 5, 6500],
  ["ROFI", "JAMBORE WANGKI", 25, 6500],
  // MAS IPUNG
  ["MAS IPUNG", "EMBOS VARIASI 21-07", 100, 12000],
  ["MAS IPUNG", "WAFFLE STRIPE HITAM", 128, 8000],
];

function slug(text) {
  return text
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const adminJahit = await prisma.user.findUnique({ where: { username: "jahit" } });
  if (!adminJahit) {
    throw new Error(
      "User 'jahit' tidak ditemukan. Jalankan dulu: node prisma/seed.cjs"
    );
  }

  // 1) Pastikan semua operator ada
  const operatorNames = [...new Set(ROWS.map((r) => r[0]))];
  const operatorMap = new Map();
  for (const name of operatorNames) {
    const barcode = `OP-${slug(name)}`;
    const op = await prisma.operator.upsert({
      where: { barcode_operator: barcode },
      update: {},
      create: { barcode_operator: barcode, nama_operator: name, status: "aktif" },
    });
    operatorMap.set(name, op);
  }

  // 2) Pastikan semua jenis barang punya PO (harga dari kemunculan pertama)
  const itemFirstPrice = new Map();
  for (const [, item, , harga] of ROWS) {
    if (!itemFirstPrice.has(item)) itemFirstPrice.set(item, harga);
  }
  const poMap = new Map();
  let poCounter = 1;
  for (const [item, harga] of itemFirstPrice) {
    const nomor_po = `PO-20260801-${String(poCounter).padStart(4, "0")}`;
    const barcode_po = `GDR-PO-2026080100${String(poCounter).padStart(3, "0")}`;
    const po = await prisma.purchaseOrder.upsert({
      where: { nomor_po },
      update: {},
      create: {
        nomor_po,
        barcode_po,
        nama_po: item,
        nama_artikel: item,
        harga_satuan: harga,
        status: "berjalan",
        created_by: adminJahit.id,
      },
    });
    poMap.set(item, po);
    poCounter++;
  }

  // 3) Masukkan setiap baris sebagai setoran jahit
  let created = 0;
  for (const [operatorName, item, qty, harga] of ROWS) {
    const operator = operatorMap.get(operatorName);
    const po = poMap.get(item);
    await prisma.setoranJahit.create({
      data: {
        tanggal_setoran: TANGGAL,
        operator_id: operator.id,
        po_id: po.id,
        qty_disetor: qty,
        harga_satuan_snapshot: harga,
        total_upah: qty * harga,
        admin_jahit_id: adminJahit.id,
      },
    });
    created++;
  }

  console.log(`Selesai. ${created} setoran jahit berhasil dimasukkan untuk tanggal 01/08/2026.`);
  console.log(`Operator: ${operatorMap.size}, Jenis barang/PO: ${poMap.size}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
