// Listet alle deutschen Texte in der Oberflaeche. Nur lesen, nichts aendern.
import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP = new Set(["datenschutz.tsx", "impressum.tsx", "regeln.tsx", "nutzungsbedingungen.tsx", "admin.meldungen.tsx", "admin.zahlen.tsx"]);
const ATTRS = new Set(["placeholder", "aria-label", "title", "alt", "label", "body", "hint", "description"]);
const hasLetter = (text) => /[A-Za-zÄÖÜäöüß]{2,}/.test(text);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

export function scan(file) {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(sf).replace(/\s+/g, " ").trim();
      if (text && hasLetter(text)) found.push({ kind: "text", text, pos: node.getStart(sf), end: node.getEnd() });
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && ATTRS.has(node.name.getText(sf))) {
      if (hasLetter(node.initializer.text)) found.push({ kind: "attr", text: node.initializer.text, pos: node.initializer.getStart(sf), end: node.initializer.getEnd() });
    } else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const lits = [];
      const inner = (n) => {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) lits.push(n);
        else if (ts.isTemplateExpression(n)) lits.push(n);
        else if (ts.isConditionalExpression(n)) {
          inner(n.whenTrue);
          inner(n.whenFalse);
        } else if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken || n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
          inner(n.right);
        } else if (ts.isParenthesizedExpression(n)) inner(n.expression);
      };
      inner(node.expression);
      for (const lit of lits) {
        const text = ts.isTemplateExpression(lit) ? lit.getText(sf).slice(1, -1) : lit.text;
        if (hasLetter(text)) found.push({ kind: ts.isTemplateExpression(lit) ? "template" : "expr", text, pos: lit.getStart(sf), end: lit.getEnd() });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

if (process.argv[1].endsWith("i18n-scan.mjs")) {
  const files = ["src/routes", "src/components"].flatMap(walk).filter((file) => !SKIP.has(file.split("/").pop()));
  const all = new Map();
  let total = 0;
  for (const file of files) {
    const items = scan(file);
    total += items.length;
    for (const item of items) all.set(item.text, (all.get(item.text) ?? 0) + 1);
    if (items.length) console.log(String(items.length).padStart(4), file);
  }
  console.log("\\nStellen:", total, " verschiedene Texte:", all.size);
}
