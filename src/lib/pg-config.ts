import type { PoolConfig } from "pg";

/**
 * Builds the node-postgres pool config for the Prisma driver adapter.
 *
 * - Supabase poolers present a certificate signed by Supabase's own CA, which
 *   Node does not trust by default. The connection is still TLS-encrypted, but
 *   certificate-chain verification is relaxed for Supabase hosts. `sslmode` is
 *   stripped from the URL because pg would otherwise override the `ssl` object.
 * - On Vercel (serverless) each function instance keeps a small pool; the
 *   Supabase transaction pooler (port 6543) multiplexes these.
 */
export function pgPoolConfig(url = process.env.DATABASE_URL!): PoolConfig {
  let connectionString = url;
  let ssl: PoolConfig["ssl"];
  try {
    const u = new URL(url);
    const isLocal = ["localhost", "127.0.0.1", ""].includes(u.hostname) || u.hostname.endsWith(".railway.internal");
    const mode = u.searchParams.get("sslmode");
    u.searchParams.delete("sslmode");
    u.searchParams.delete("pgbouncer");
    connectionString = u.toString();
    if (mode === "disable" || (isLocal && !mode)) ssl = undefined;
    else if (/supabase\.(co|com)$/.test(u.hostname) || mode) ssl = { rejectUnauthorized: false };
  } catch {
    /* non-URL form (e.g. socket path) — use as-is */
  }
  return {
    connectionString,
    ssl,
    max: process.env.VERCEL ? 3 : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  };
}
