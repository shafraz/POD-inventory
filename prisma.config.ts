import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma configuration.
 *
 * By default the standard (binary) schema engine is used for migrations.
 * In restricted/offline environments where Prisma engine binaries cannot be
 * downloaded, set PRISMA_JS_ENGINE=1 to run migrations through the
 * WebAssembly schema engine + node-postgres driver adapter instead.
 */
const useJsEngine = process.env.PRISMA_JS_ENGINE === "1";

export default useJsEngine
  ? defineConfig({
      experimental: { adapter: true },
      engine: "js",
      schema: path.join("prisma", "schema.prisma"),
      migrations: { path: path.join("prisma", "migrations"), seed: "tsx prisma/seed.ts" },
      async adapter() {
        return new PrismaPg({ connectionString: process.env.DATABASE_URL! });
      },
    })
  : defineConfig({
      schema: path.join("prisma", "schema.prisma"),
      migrations: { path: path.join("prisma", "migrations"), seed: "tsx prisma/seed.ts" },
    });
