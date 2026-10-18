// Lists string literals in the UI code that look like German prose but are not passed through t(). Run from meeqo-app.
import fs from "node:fs";
import path from "node:path";
const roots = ["src/routes", "src/components"];
const skip = /(className|key|type|to|href|id|name|src|alt|role|value|from|art|tone|inputMode|autoComplete|aria-live|htmlFor|rel|target|method|accept|lang|style|data-[\w-]+)\s*[=:]\s*$/;
const out = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name) && !/routeTree/.test(entry.name)) scan(full);
  }
}
function scan(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (/^\s*(import|\/\/|\*|\/\*)/.test(line)) return;
    for (const match of line.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
      const body = match[2];
      const before = line.slice(0, match.index);
      if (/t\(\s*$/.test(before) || /\bt\(\s*$/.test(before)) continue;
      if (skip.test(before)) continue;
      if (!/[A-Za-zÄÖÜäöüß]{3,}.*\s.*[A-Za-zÄÖÜäöüß]{2,}|[äöüß]|^[A-ZÄÖÜ][a-zäöüß]{3,}[.!?…]?$/.test(body)) continue;
      if (/^[\w\s:#/.\-[\]()%*,|=>"'`${}?&+<~^]+$/.test(body) && !/[äöüßÄÖÜ]/.test(body) && !/\s(und|nicht|oder|mit|für|dein|eine?|wir|ich|der|die|das|zu|ist|im|am|bei)\s/i.test(body)) continue;
      out.push(`${file}:${index + 1}: ${body.slice(0, 90)}`);
    }
  });
}
roots.forEach(walk);
console.log(out.join("\n"));
console.error(out.length, "candidates");
