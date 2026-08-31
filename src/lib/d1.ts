import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

// Direct D1 access, bypassing Prisma's query engine entirely.
//
// WHY THIS FILE EXISTS: @prisma/client's `workerd` export condition still
// resolves to the binary/library runtime (runtime/library.js), which calls
// eval("__dirname") while resolving the query engine path. Cloudflare
// Workers blocks eval() unconditionally, so any route that touches
// src/lib/prisma.ts throws in production even though it works fine in
// `next dev`. This is a known open compatibility gap between Prisma and
// Workers (the driver-adapter/wasm runtime is not what workerd resolves to).
// Until that's fixed upstream, routes are being migrated one at a time to
// call env.DB (D1's native prepare/bind/run API) directly.
//
// LOCAL DEV NOTE: `next dev` has no D1 binding, so getCloudflareContext()
// throws outside of `wrangler dev` / the deployed Worker. Routes that use
// getDB() will only work locally via `wrangler dev` (or `opennextjs-cloudflare
// preview`), not plain `npm run dev`. Routes still on Prisma keep working
// under `npm run dev` via the SQLite fallback in src/lib/prisma.ts.

export function getDB(): D1Database {
  const { env } = getCloudflareContext();
  const cloudflareEnv = env as unknown as { DB?: D1Database; gudara_db?: D1Database };
  const db = cloudflareEnv.DB || cloudflareEnv.gudara_db;

  if (!db) {
    throw new Error(
      "Koneksi database D1 tidak ditemukan melalui getCloudflareContext(). " +
        "Pastikan binding 'DB' terpasang di wrangler.jsonc dan route dijalankan lewat Worker (bukan `next dev`)."
    );
  }

  return db;
}
