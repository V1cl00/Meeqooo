#!/usr/bin/env node
/**
 * Production start for a plain Node host (e.g. Render): `npm start`.
 *
 * - On Render, BETTER_AUTH_URL defaults to RENDER_EXTERNAL_URL (the service's
 *   https://<name>.onrender.com URL), so Better Auth's origin check accepts the
 *   real public host without hard-coding it.
 * - With DATABASE_URL set, applies pending migrations first (idempotent); without
 *   it the server uses the in-memory PGLite fallback, which migrates itself.
 * - Then loads the Nitro node-server build (.output/server/index.mjs), which
 *   listens on $PORT.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.BETTER_AUTH_URL?.trim() && process.env.RENDER_EXTERNAL_URL) {
  process.env.BETTER_AUTH_URL = process.env.RENDER_EXTERNAL_URL;
}
if (process.env.BETTER_AUTH_URL) console.log(`[start] BETTER_AUTH_URL=${process.env.BETTER_AUTH_URL}`);

if (process.env.DATABASE_URL?.trim()) {
  const r = spawnSync(process.execPath, [join(root, "scripts/migrate.mjs")], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
} else {
  console.log("[start] DATABASE_URL not set — using in-memory PGLite (data resets on restart).");
}

await import(pathToFileURL(join(root, ".output/server/index.mjs")).href);
