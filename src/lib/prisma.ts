import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

// Cloudflare D1 has no persistent Node-style connection, so unlike a normal
// SQLite/Postgres setup we can't build one PrismaClient at module load time.
// Instead we lazily build a client from the request's D1 binding (env.DB)
// the first time it's touched, then reuse it for the life of that request.
//
// LOCAL DEV NOTE: for local `npm run dev` we skip the Cloudflare D1 emulator
// entirely (it needs to spawn workerd/miniflare, which fails on this machine)
// and fall back to a plain SQLite PrismaClient using DATABASE_URL from .env.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

let cachedClient: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (cachedClient) return cachedClient;

  try {
    const { env } = getCloudflareContext();
    const adapter = new PrismaD1(env.DB);
    cachedClient = new PrismaClient({ adapter });
  } catch {
    cachedClient = new PrismaClient();
  }

  return cachedClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;
