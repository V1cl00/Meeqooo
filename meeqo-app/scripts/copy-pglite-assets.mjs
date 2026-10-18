#!/usr/bin/env node
/**
 * Nitro bundles @electric-sql/pglite into the server output but not its runtime
 * assets (pglite.wasm, pglite.data, initdb.wasm, extension tarballs), which the
 * bundled module loads from its own directory. Without them the PGLite fallback
 * (no DATABASE_URL) crashes on start with ENOENT. Copy them next to every
 * bundled pglite module in .output (node-server) and .vercel/output (vercel).
 */
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const pgliteDist = dirname(require.resolve("@electric-sql/pglite"));
const assets = readdirSync(pgliteDist).filter((f) => /\.(wasm|data|tar\.gz)$/.test(f));

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let targets = 0;
for (const out of [".output", ".vercel/output"].map((d) => join(root, d))) {
  if (!existsSync(out)) continue;
  const dirs = new Set();
  for (const file of walk(out)) {
    if (/pglite[^/]*\.m?js$/.test(file.split("/").pop())) dirs.add(dirname(file));
  }
  for (const dir of dirs) {
    for (const a of assets) copyFileSync(join(pgliteDist, a), join(dir, a));
    targets += 1;
    console.log(`[pglite-assets] ${assets.length} files -> ${dir.slice(root.length + 1)}`);
  }
}
if (!targets) console.log("[pglite-assets] no bundled pglite module found — nothing to copy.");
