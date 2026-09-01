# GUDARA Production & Sewing Tracker

Internal app for recording garment production POs and daily sewing output through barcode scanners.

Stack: Next.js App Router, Tailwind CSS, Shadcn-style UI components, Prisma, SQLite for development, PostgreSQL-ready schema notes, and XLSX export.

## 1. Install

```bash
npm install
```

The repository includes a local development `.env`:

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="change-this-to-a-long-random-string-for-local-development"
```

## 2. Create the database and seed demo data

```bash
npx prisma migrate dev --name init
npm run seed
```

This creates:

- Admin Produksi login: `produksi` / `gudara123`
- Admin Jahit login: `jahit` / `gudara123`
- Admin Cutting login: `cutting` / `gudara123`
- Sample operator barcodes: `OP-0001`, `OP-0002`, `OP-0003`
- Sample PO barcode: `GDR-PO-2026080400001`

## 3. Run

```bash
npm run dev
```

Open http://localhost:3000.

Login as `produksi` to open Dashboard Produksi. Use `Input Produksi` to create a PO; `nomor_po` and `barcode_po` are generated automatically.

Login as `jahit` to open Dashboard Setoran Jahit. Use `Input Setoran Jahit` for the scanner workflow:

1. Scan operator ID. The modal auto-focuses this field when opened.
2. Scan PO barcode. The operator field locks and focus moves here automatically.
3. Type QTY and press Enter.
4. The setoran is saved, the modal stays open, and focus returns to operator scan for the next entry.

Most USB/Bluetooth barcode scanners act like keyboards and send Enter after each scan. The modal also handles Tab suffixes for the operator and PO scan fields.

Login as `cutting` to open Dashboard Cutting. Alurnya sama persis (scan operator → scan PO → QTY), disimpan terpisah dari setoran jahit supaya QTY cutting bisa dibandingkan dengan QTY jahit untuk PO yang sama — perbandingan ini muncul otomatis di modal input, di Dashboard Cutting, dan di detail PO pada Board Produksi.

## 4. Export

On the Jahit dashboard, click `Export ke Excel` to download today's setoran as `.xlsx` with these columns:

- Nama Operator Jahit
- Nama PO
- Tanggal Setoran
- Artikel
- Harga Satuan
- QTY
- Totalan (Total Upah)

## PostgreSQL Notes

For production, change the Prisma datasource provider to `postgresql` and set `DATABASE_URL` to your PostgreSQL connection string.

Money fields already use Prisma `Decimal`. SQLite does not support Prisma native enums, so role/status fields are stored as strings and validated by the app. When switching to PostgreSQL, you can convert those fields to Prisma enums if you want database-level enum constraints.
