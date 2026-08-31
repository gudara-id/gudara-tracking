const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare');

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Wajib untuk Prisma di Cloudflare Workers (via OpenNext) — memastikan
  // @prisma/client & .prisma/client dibundle dengan benar untuk runtime workerd
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

module.exports = nextConfig;