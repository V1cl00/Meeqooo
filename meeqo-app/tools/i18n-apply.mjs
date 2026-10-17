// Wickelt deutsche Texte in der Oberflaeche in t("...") ein. Einmalig. Schreibt die Datei nur, wenn sich etwas aendert.
import ts from "typescript";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP = new Set(["datenschutz.tsx", "impressum.tsx", "regeln.tsx", "nutzungsbedingungen.tsx", "admin.meldungen.tsx", "admin.zahlen.tsx"]);
const ATTRS = new Set(["placeholder", "aria-label", "title", "alt", "label", "body", "hint", "description"]);
const hasLetter = (text) => /[A-Za-zÄÖÜäöüß]{2,}/.test(text);
const q = (text) => JSON.stringify(text);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

function decode(text) {
  return text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}

/** What React renders for a JSX text node: lines trimmed at line breaks, empty lines dropped. */
function rendered(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  const out = [];
  lines.forEach((line, index) => {
    let text = line.replace(/\t/g, " ");
    if (index !== 0) text = text.replace(/^ +/, "");
    if (index !== lines.length - 1) text = text.replace(/ +$/, "");
    if (text) out.push(text);
  });
  return decode(out.join(" "));
}

function containsJsx(node) {
  let found = false;
  const visit = (n) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) found = true;
    if (!found) ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function processFile(file) {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const mixed = [];
  const keys = new Set();

  /** String literals in the branches of an expression become t("..."). Returns the new source text. */
  function wrapLiterals(node) {
    const local = [];
    const inner = (n) => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        if (hasLetter(n.text)) local.push({ start: n.getStart(sf), end: n.getEnd(), text: `t(${q(n.text)})`, key: n.text });
      } else if (ts.isTemplateExpression(n)) {
        const parts = [n.head.text];
        const args = [];
        n.templateSpans.forEach((span, index) => {
          parts.push(`{${index}}`, span.literal.text);
          args.push(span.expression.getText(sf));
        });
        const key = parts.join("");
        if (hasLetter(key)) local.push({ start: n.getStart(sf), end: n.getEnd(), text: `t(${q(key)}${args.map((a) => `, ${a}`).join("")})`, key });
      } else if (ts.isConditionalExpression(n)) {
        inner(n.whenTrue);
        inner(n.whenFalse);
      } else if (ts.isBinaryExpression(n) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)) {
        inner(n.right);
      } else if (ts.isParenthesizedExpression(n)) inner(n.expression);
    };
    inner(node);
    let text = node.getText(sf);
    const base = node.getStart(sf);
    for (const edit of local.sort((a, b) => b.start - a.start)) {
      text = text.slice(0, edit.start - base) + edit.text + text.slice(edit.end - base);
      keys.add(edit.key);
    }
    return text;
  }

  function tryMerge(node) {
    const children = node.children;
    const meaningful = children.filter((child) => !(ts.isJsxText(child) && !child.getFullText(sf).trim() && /[\r\n]/.test(child.getFullText(sf))));
    if (!meaningful.length) return false;
    if (meaningful.some((child) => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child))) return false;
    if (meaningful.some((child) => ts.isJsxExpression(child) && child.expression && containsJsx(child.expression))) return false;
    const texts = meaningful.filter((child) => ts.isJsxText(child));
    if (!texts.some((child) => hasLetter(rendered(child.getFullText(sf))))) return false;
    let key = "";
    const args = [];
    for (const child of meaningful) {
      if (ts.isJsxText(child)) key += rendered(child.getFullText(sf));
      else if (ts.isJsxExpression(child)) {
        if (!child.expression) continue;
        if (ts.isStringLiteral(child.expression) && !hasLetter(child.expression.text)) key += child.expression.text;
        else {
          key += `{${args.length}}`;
          args.push(wrapLiterals(child.expression));
        }
      }
    }
    key = key.replace(/\s+/g, " ").trim();
    if (!hasLetter(key)) return false;
    keys.add(key);
    const first = meaningful[0];
    const start = ts.isJsxText(first) ? first.pos : first.getStart(sf);
    const end = meaningful[meaningful.length - 1].getEnd();
    // keep a leading/trailing space that sits next to the first/last text node on the same line
    edits.push({ start, end, text: `{t(${q(key)}${args.map((a) => `, ${a}`).join("")})}` });
    return true;
  }

  const visit = (node) => {
    if ((ts.isJsxElement(node) || ts.isJsxFragment(node)) && tryMerge(node)) {
      // children are replaced as a whole; still look at the attributes of the opening element
      if (ts.isJsxElement(node)) visit(node.openingElement);
      return;
    }
    if (ts.isJsxText(node)) {
      const raw = node.getFullText(sf);
      const text = rendered(raw).trim();
      if (text && hasLetter(text)) {
        const lead = /^[ \t]+(?=\S)/.test(raw) && !/^\s*[\r\n]/.test(raw);
        const trail = /(?<=\S)[ \t]+$/.test(raw) && !/[\r\n]\s*$/.test(raw);
        keys.add(text);
        // mixed text next to elements is flagged: word order may need a hand
        mixed.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text });
        edits.push({ start: node.pos, end: node.getEnd(), text: `${lead ? '{" "}' : ""}{t(${q(text)})}${trail ? '{" "}' : ""}` });
      }
      return;
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && ATTRS.has(node.name.getText(sf))) {
      if (hasLetter(node.initializer.text)) {
        keys.add(node.initializer.text);
        edits.push({ start: node.initializer.getStart(sf), end: node.initializer.getEnd(), text: `{t(${q(node.initializer.text)})}` });
      }
      return;
    }
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const text = wrapLiterals(node.expression);
      if (text !== node.expression.getText(sf)) edits.push({ start: node.expression.getStart(sf), end: node.expression.getEnd(), text });
      ts.forEachChild(node, (child) => {
        if (containsJsx(child)) visit(child);
      });
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!edits.length) return { changed: false, keys, mixed };
  // drop edits that sit inside another edit
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const clean = [];
  for (const edit of edits) if (!clean.length || edit.start >= clean[clean.length - 1].end) clean.push(edit);
  let out = source;
  for (const edit of clean.reverse()) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  if (!/from "@\/lib\/meeqo\/i18n"/.test(out)) {
    const imports = [...out.matchAll(/^import .*$/gm)];
    const last = imports[imports.length - 1];
    const at = last ? last.index + last[0].length : 0;
    out = out.slice(0, at) + '\nimport { t } from "@/lib/meeqo/i18n";' + out.slice(at);
  }
  writeFileSync(file, out);
  return { changed: true, keys, mixed };
}

const all = new Set();
const report = [];
for (const file of ["src/routes", "src/components"].flatMap(walk).filter((f) => !SKIP.has(f.split("/").pop()))) {
  const result = processFile(file);
  for (const key of result.keys) all.add(key);
  if (result.changed) report.push(file);
}
writeFileSync("tools/i18n-keys.json", JSON.stringify([...all].sort(), null, 2));
console.log("Dateien:", report.length, "Schluessel:", all.size);
