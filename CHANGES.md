# Fitur "Input Cutting"

File-file di sini adalah file yang **baru dibuat** atau **diedit** untuk
menambahkan alur "Input Cutting" — sama persis dengan alur "Input Setoran
Jahit" (scan operator → scan PO → isi QTY) — dengan role login baru
`admin_cutting`, sehingga QTY yang sudah dicutting bisa langsung dibandingkan
dengan QTY yang sudah dijahit untuk PO yang sama.

Salin semua file ini ke lokasi yang sama di project kamu (timpa file yang
sudah ada), lalu jalankan migrasi database.

## 1. Jalankan migrasi database (WAJIB, sekali saja)

```
npx wrangler d1 execute gudara-db --local  --file=./migration_add_cutting.sql
npx wrangler d1 execute gudara-db --remote --file=./migration_add_cutting.sql
```

Ini membuat tabel baru `setoran_cutting` (struktur sama seperti
`setoran_jahit`, tanpa `harga_satuan`/`total_upah` karena cutting saat ini
tidak dihitung borongan per pcs) dan otomatis menambahkan akun demo
`cutting` / `gudara123` dengan role `admin_cutting`.

## 2. File yang diedit/dibuat

| File | Status | Keterangan |
|---|---|---|
| `prisma/schema.prisma` | diedit | model baru `SetoranCutting` + relasi ke `User`, `Operator`, `PurchaseOrder`; role `admin_cutting` ditambahkan ke komentar `UserRole` |
| `prisma/migration.sql` | diedit | tabel `setoran_cutting` ditambahkan (untuk instalasi baru dari nol) |
| `prisma/seed.ts`, `prisma/seed.sql` | diedit | akun demo `cutting` / `gudara123` |
| `migration_add_cutting.sql` | baru | migrasi tambahan untuk database D1 yang sudah berjalan (lihat langkah 1) |
| `src/lib/auth.ts` | diedit | role `admin_cutting` ditambahkan ke tipe session |
| `src/lib/profile.ts` | diedit | role `admin_cutting` + label "Admin Cutting" |
| `src/lib/validators.ts` | diedit | role `admin_cutting` ditambahkan ke `USER_ROLES` |
| `src/middleware.ts` | diedit | proteksi route `/cutting` & `/api/setoran-cutting`, redirect home untuk role `admin_cutting` |
| `src/app/api/auth/login/route.ts` | diedit | redirect login `admin_cutting` → `/cutting` |
| `src/components/Sidebar.tsx` | diedit | menu "Dashboard Cutting" untuk role `admin_cutting` |
| `src/app/konfigurasi/konfigurasi-client.tsx` | diedit | opsi role "Admin Cutting" di form tambah user |
| `src/app/api/setoran-cutting/route.ts` | baru | `GET`/`POST` — alur & bentuk sama persis dengan `/api/setoran`, tapi tabel `setoran_cutting`; `POST` mencatat log aktivitas ke PO dengan info selisih QTY cutting vs jahit |
| `src/app/api/setoran-cutting/export/route.ts` | baru | export Excel setoran cutting |
| `src/app/api/po/lookup/route.ts` | diedit | sekarang mengembalikan `qty_terselesaikan_jahit` **dan** `qty_terselesaikan_cutting` sekaligus, dipakai kedua modal untuk saling menampilkan perbandingan real-time saat scan PO |
| `src/components/InputSetoranCuttingModal.tsx` | baru | modal "Input Cutting" — mirror `InputSetoranJahitModal`, tanpa field harga/upah, menampilkan progress cutting PO + perbandingan terhadap total jahit |
| `src/components/InputSetoranJahitModal.tsx` | diedit | menampilkan info "Cutting untuk PO ini: X pcs" sebagai pembanding saat admin jahit scan PO |
| `src/app/cutting/page.tsx`, `src/app/cutting/cutting-dashboard-client.tsx` | baru | Dashboard Cutting — mirror Dashboard Setoran Jahit (filter tanggal/operator, ranking, export Excel/PDF), ditambah panel "Perbandingan Cutting vs Jahit per PO" yang menandai PO mana yang QTY-nya belum sama persis |
| `src/app/api/po/_shared.ts`, `src/app/api/po/route.ts` | diedit | tiap PO di Board Produksi sekarang membawa agregat `qty_jahit` & `qty_cutting` |
| `src/app/produksi/produksi-dashboard-client.tsx` | diedit | panel "Progress Cutting vs Jahit" di detail PO, menandai kalau QTY keduanya belum sama |
| `README.md` | diedit | login demo `cutting` / `gudara123` + penjelasan singkat alurnya |

## 3. Alur fitur

1. Admin produksi buat user baru dengan role **Admin Cutting** lewat
   Konfigurasi → User (atau pakai akun demo `cutting` / `gudara123`).
2. Admin cutting login → masuk ke **Dashboard Cutting** (`/cutting`).
3. Klik **"+ Input Cutting"** → scan ID operator → scan barcode PO pada
   bundel → isi QTY → (opsional) QTY reject + catatan + foto → Simpan.
   Begitu PO discan, modal langsung menampilkan progress cutting untuk PO
   itu **dan** total jahit yang sudah masuk, dengan penanda kalau
   keduanya belum sama.
4. Setiap input cutting otomatis tercatat di feed **"Aktivitas dan Status"**
   pada kartu PO di Board Produksi (sama seperti setoran jahit),
   berdampingan dengan log setoran jahit.
5. Di detail PO (Board Produksi), admin produksi bisa lihat panel
   **"Progress Cutting vs Jahit"** yang menandai PO dengan badge hijau
   ("QTY sudah sama persis") atau kuning ("Beda N pcs, belum sama").
6. Dashboard Cutting juga punya panel **"Perbandingan Cutting vs Jahit per
   PO"** untuk melihat semua PO pada periode yang dipilih sekaligus.
7. Sebaliknya, saat admin jahit input setoran dan scan PO yang sama, modal
   Input Setoran Jahit juga menampilkan total cutting untuk PO tsb sebagai
   pembanding.

## 4. Catatan

- Cutting **tidak** menyimpan `harga_satuan`/`total_upah` — saat ini tidak
  dihitung borongan per pcs seperti jahit, jadi tidak ada slip upah untuk
  cutting. Kalau nanti perlu payroll cutting juga, tambahkan kolom harga
  satuan cutting (mis. di `PurchaseOrder`) dan kolom senada dengan
  `SetoranJahit.harga_satuan_snapshot`/`total_upah` di `SetoranCutting`.
- Role login untuk yang melakukan input cutting dinamai `admin_cutting`
  (bukan `operator_cutting`) supaya konsisten dengan penamaan role yang
  sudah ada di app ini (`admin_produksi`, `admin_jahit` — nama "admin_x"
  dipakai untuk role yang melakukan input, bukan untuk operator lini
  produksi itu sendiri).
- Perbandingan QTY jahit vs cutting bersifat **informasional** (badge
  hijau/kuning) — sistem tidak memblokir input cutting/jahit walau
  totalnya belum sama, karena keduanya biasanya diinput bertahap sepanjang
  hari.
- Sudah dicek dengan `tsc --noEmit` — tidak ada type error. `npx next build`
  sempat dicoba di sandbox ini tapi gagal di langkah OpenNext/Wrangler
  karena butuh `CLOUDFLARE_API_TOKEN` yang tidak tersedia di sini — jalankan
  `npm run deploy` (atau minimal `npm run build`) di environment kamu
  sendiri untuk verifikasi build penuh sebelum deploy. `prisma generate`
  juga tidak sempat dijalankan ulang (gagal unduh binary Prisma karena
  dibatasi jaringan sandbox) — jalankan `npx prisma generate` di environment
  kamu sendiri; tidak wajib untuk fitur ini berfungsi karena semua route di
  atas pakai raw SQL lewat D1.
