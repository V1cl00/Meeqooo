// Prints every t("...") key in src that has no English text yet. Run from meeqo-app.
import fs from "node:fs";
import path from "node:path";
const en = fs.readFileSync("src/lib/meeqo/en.ts", "utf8");
const have = new Set([...en.matchAll(/^  ("(?:[^"\\]|\\.)*"):/gm)].map((m) => JSON.parse(m[1])));
const missing = new Set();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name) && entry.name !== "en.ts" && entry.name !== "i18n.ts") {
      const text = fs.readFileSync(full, "utf8");
      for (const m of text.matchAll(/\bt\(\s*("(?:[^"\\]|\\.)*")/g)) {
        const key = JSON.parse(m[1]);
        if (!have.has(key) && /[A-Za-zÄÖÜäöüß]{2,}/.test(key)) missing.add(key);
      }
    }
  }
}
walk("src");
console.log(JSON.stringify(Object.fromEntries([...missing].sort().map((k) => [k, ""])), null, 1));
console.error(missing.size, "missing");
