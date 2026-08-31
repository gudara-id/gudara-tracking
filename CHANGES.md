# Fitur "Input Order" + Validasi Produksi

File-file di zip ini adalah file yang **baru dibuat** atau **diedit** untuk
menambahkan tombol "Input Order" di halaman Order, lengkap dengan alur
validasi admin produksi sebelum jadi PO di board produksi.

Salin semua file ini ke lokasi yang sama di project kamu (timpa file yang
sudah ada), lalu jalankan migrasi database.

## 1. Jalankan migrasi database (WAJIB, sekali saja)

```
npx wrangler d1 execute gudara-db --local  --file=./migration_add_order_manual_input.sql
npx wrangler d1 execute gudara-db --remote --file=./migration_add_order_manual_input.sql
```

Ini menambah 3 kolom baru ke tabel `orders`: `nama_po`, `metode_pembayaran`,
dan `po_id`.

## 2. File yang diedit/dibuat

| File | Status | Keterangan |
|---|---|---|
| `prisma/schema.prisma` | diedit | tambah `nama_po`, `metode_pembayaran`, `po_id` di model `Order` + relasi ke `PurchaseOrder` |
| `migration_add_order_manual_input.sql` | baru | migrasi SQL untuk D1 |
| `src/lib/validators.ts` | diedit | tambah `METODE_PEMBAYARAN_OPTIONS` |
| `src/app/api/order/route.ts` | diedit | tambah `POST` — endpoint untuk simpan order manual dari tombol "Input Order" |
| `src/app/api/order/[id]/route.ts` | diedit | `PATCH` sekarang juga bisa update `nama_po` & `metode_pembayaran` |
| `src/app/api/order/[id]/validate-po/route.ts` | baru | `POST` — endpoint validasi (admin_produksi only) yang membuat `PurchaseOrder` sungguhan dari order |
| `src/components/InputOrderModal.tsx` | baru | form modal "Input Order" |
| `src/app/order/page.tsx` | diedit | oper `role` session ke client component |
| `src/app/order/order-dashboard-client.tsx` | diedit | tombol "Input Order", badge status validasi, panel Nama PO + tombol "Validasi & Buat PO Produksi" |
| `src/app/produksi/produksi-dashboard-client.tsx` | diedit | banner jumlah permintaan Input PO yang menunggu validasi (khusus admin_produksi) |

## 3. Alur fitur

1. Admin/sales klik **"Input Order"** di halaman Order → isi form:
   Nama Konsumen, No. Telepon, **Nama PO**, Deadline, daftar Produk
   (pilih dari katalog SKU atau ketik manual) + Qty + Harga → Total
   otomatis, Input DP/Pembayaran, Metode Pembayaran, Detail Pesanan.
2. Submit → order tersimpan dengan status **"Baru"**, muncul di tabel Order
   dengan badge **"Menunggu validasi PO"**. Ini juga muncul sebagai banner
   peringatan jumlah permintaan di halaman **Board Produksi**.
3. **admin_produksi** buka detail order tsb → cek/lengkapi Nama PO →
   klik **"Validasi & Buat PO Produksi"**.
4. Sistem otomatis membuat `PurchaseOrder` baru (dengan nomor PO, barcode,
   semua item produk order sebagai `purchase_order_articles`, status di
   kolom pertama board) dan menandai order tsb `po_id` terisi + status
   **"Diproses"**. PO langsung muncul di Board Produksi untuk diproses tim
   produksi seperti biasa.
5. Order dengan `po_id` terisi tidak bisa divalidasi dua kali (tombol
   validasi hilang, diganti badge "Sudah divalidasi & punya PO produksi").

## 4. Catatan

- Order yang masuk lewat **form pemesanan publik** (`/order-form`) tetap
  berjalan seperti sebelumnya, statusnya "Baru" tanpa `nama_po`. Admin
  produksi bisa mengisi Nama PO-nya lewat panel detail order sebelum
  memvalidasi jadi PO, kalau memang order tsb perlu diproduksi.
- Hanya role **admin_produksi** yang bisa menekan tombol validasi
  (endpoint `/api/order/[id]/validate-po` menolak role lain).
- Sudah dicek dengan `tsc --noEmit` — tidak ada type error. `prisma
  generate` tidak sempat dijalankan ulang di sandbox ini (gagal unduh
  binary Prisma karena dibatasi jaringan) — jalankan
  `npx prisma generate` di environment kamu sendiri untuk memastikan
  Prisma Client ikut ter-update (walau route di atas semuanya pakai raw
  SQL lewat D1, jadi tidak wajib untuk fitur ini berfungsi).
