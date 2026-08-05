# Deploy ke Cloudflare Workers + D1

Aplikasi ini sudah dimodifikasi supaya bisa jalan di Cloudflare Workers, dengan
database Cloudflare D1 (SQLite-compatible, serverless) menggantikan file `dev.db` lokal.
Deploy-nya pakai adapter **OpenNext** (`@opennextjs/cloudflare`), yaitu adapter resmi
yang direkomendasikan Cloudflare untuk Next.js — bukan `@cloudflare/next-on-pages` yang
sudah deprecated.

Jalankan semua perintah di bawah ini di **komputer Anda sendiri** (bukan di chat),
dari dalam folder project ini, setelah extract zip ke lokasi **tanpa spasi** di path-nya
(misalnya `D:\gudara-tracker`).

## 0. Install dependency & login Cloudflare

```powershell
npm install
npx wrangler login
```

Ini akan membuka browser untuk login/menghubungkan akun Cloudflare Anda.

## 1. Buat database D1

```powershell
npx wrangler d1 create gudara-db
```

Perintah ini akan mencetak output yang berisi `database_id`, contoh:

```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy nilai itu, lalu buka file `wrangler.jsonc` di folder project, dan ganti
`REPLACE-WITH-YOUR-D1-DATABASE-ID` dengan id tersebut.

## 2. Buat tabel di database (migration)

```powershell
npm run d1:migrate:remote
```

## 3. Isi data contoh (opsional tapi disarankan untuk uji coba pertama)

```powershell
npm run d1:seed:remote
```

Ini membuat 2 akun login demo:
- `produksi` / `gudara123`
- `jahit` / `gudara123`

serta 3 barcode operator contoh (`OP-0001`, `OP-0002`, `OP-0003`) dan 1 PO contoh
(`GDR-PO-2026080400001`).

**Catatan keamanan:** setelah aplikasi jalan, segera ganti password akun-akun ini
lewat menu Konfigurasi, atau hapus dan buat user baru — jangan biarkan password
demo `gudara123` dipakai di production.

## 4. Set SESSION_SECRET sebagai secret di Cloudflare

Jangan taruh secret asli di `wrangler.jsonc` atau `.env` yang ikut ter-deploy.
Generate string acak dulu:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Lalu simpan sebagai secret Worker (akan diminta paste nilainya):

```powershell
npx wrangler secret put SESSION_SECRET
```

## 5. Build & deploy

```powershell
npm run deploy
```

Perintah ini build project dengan OpenNext lalu upload sebagai Cloudflare Worker.
Di akhir proses akan muncul URL seperti `https://gudara-tracker.<akun-anda>.workers.dev`
— itu alamat aplikasi Anda.

## 6. Deploy ulang setelah ada perubahan kode

Cukup ulangi:

```powershell
npm run deploy
```

## Uji coba lokal dulu (opsional, sebelum deploy ke internet)

```powershell
npm run d1:migrate:local
npm run d1:seed:local
npm run preview
```

`preview` menjalankan aplikasi di komputer Anda tapi dengan environment yang mensimulasikan
Cloudflare Workers (termasuk binding D1 lokal), jadi lebih mendekati kondisi production
dibanding `npm run dev` biasa.

## Kalau ingin custom domain (misalnya tracker.gudara.id)

Setelah deploy sukses, di Cloudflare dashboard → Workers & Pages → project
`gudara-tracker` → Settings → Domains & Routes → Add custom domain. Sama seperti
yang sudah pernah Anda lakukan untuk `wafflestripe.gudara.id` dan `jersey.gudara.id`.

## Apa saja yang berubah dari versi lokal (SQLite)?

- `prisma/schema.prisma`: menambahkan `previewFeatures = ["driverAdapters"]`, wajib untuk D1.
- `src/lib/prisma.ts`: sekarang membuat koneksi Prisma dari D1 binding per-request lewat
  OpenNext, bukan satu koneksi tetap ke file `dev.db`.
- `next` dinaikkan ke versi 15.5.22 (versi 14.2 lama tidak didukung tooling Cloudflare
  terbaru); `src/lib/auth.ts` disesuaikan karena `cookies()` di Next.js 15 menjadi async.
- File baru: `wrangler.jsonc` (konfigurasi Cloudflare Worker + binding D1),
  `open-next.config.ts` (konfigurasi adapter OpenNext), `prisma/migration.sql` dan
  `prisma/seed.sql` (pengganti `prisma migrate` dan `npm run seed` khusus untuk D1).
