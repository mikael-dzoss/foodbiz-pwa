// Finds class names in src/ that Tailwind does not generate (typos, missing tokens).
// Detection: collect class-like string literals with the TypeScript parser, then ask the real
// Tailwind v4 design system built from src/app/globals.css whether each token produces CSS.
// Known gaps: tests (`tests/`, `*.test.tsx`) are skipped; a string outside `className` is only
// checked when most of its tokens are valid classes; template literals are checked per fragment.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";
import ts from "typescript";

/** Class-like tokens that are intentionally not Tailwind (hand-written classes, markers). */
export const ALLOWLIST = new Set(["dark", "peer", "group"]);

// Calls whose string arguments are class lists.
const CLASS_CALLS = new Set(["cn", "clsx", "cva", "twMerge", "tv"]);
const TOKEN = /^[!a-z@[*&-][\w\-:/.[\]%#()&>*,=_!@'"+~^$|]*$/;

const SOURCE = /\.(tsx?)$/;
const SKIP = /(^|\/)(tests|__fixtures__)\/|\.test\.tsx?$|\.d\.ts$/;

export function listSources(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
    .filter((p) => SOURCE.test(p) && !SKIP.test(relative(dir, p)))
    .sort();
}

const COMPARISONS = new Set(["===", "!==", "==", "!="].map((o) => ts.stringToToken(o)));

/** String literals that are data, not class lists: comparisons, case labels, keys, indexes. */
function isDataString(node) {
  const p = node.parent;
  return (
    ts.isCaseClause(p) ||
    ts.isElementAccessExpression(p) ||
    (ts.isBinaryExpression(p) && COMPARISONS.has(p.operatorToken.kind)) ||
    (ts.isPropertyAssignment(p) && p.name === node) ||
    (ts.isCallExpression(p) &&
      ts.isPropertyAccessExpression(p.expression) &&
      p.expression.name.text === "includes")
  );
}

/**
 * Class strings of one source file: className attributes and cn()/clsx()/cva() arguments are
 * certain; any other multi-token string counts only when most of its tokens are valid classes
 * (variant maps), which `check` decides.
 * @returns {{ text: string, certain: boolean }[]}
 */
export function extractClassStrings(code, fileName = "file.tsx") {
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const certainNodes = new Set();
  const visit = (node) => {
    const attr =
      ts.isJsxAttribute(node) && /^(className|[a-zA-Z]*ClassName)$/.test(node.name.getText());
    const call = ts.isCallExpression(node) && CLASS_CALLS.has(node.expression.getText());
    if (attr || call) certainNodes.add(node);
    node.forEachChild(visit);
  };
  visit(sf);
  const walk = (node, certain) => {
    const isCertain = certain || certainNodes.has(node);
    if (ts.isStringLiteralLike(node)) {
      if (!isDataString(node)) found.push({ text: node.text, certain: isCertain });
    } else if (ts.isTemplateExpression(node)) {
      for (const t of [node.head.text, ...node.templateSpans.map((s) => s.literal.text)])
        found.push({ text: t, certain: isCertain });
    }
    // Strings inside a JSX attribute that is not a className are never classes.
    if (ts.isJsxAttribute(node) && !certainNodes.has(node)) return;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    node.forEachChild((child) => walk(child, isCertain));
  };
  walk(sf, false);
  return found;
}

export async function loadDesign(cssPath) {
  const css = readFileSync(cssPath, "utf8");
  return __unstable__loadDesignSystem(css, { base: join(cssPath, "..") });
}

/**
 * @param {{ text: string, certain: boolean }[]} strings
 * @param {{ candidatesToCss(c: string[]): (string | null)[] }} design
 * @returns {string[]} unknown class tokens, sorted and unique
 */
export function unknownClasses(strings, design, allow = ALLOWLIST) {
  const tokenize = (s) => s.text.split(/\s+/).filter(Boolean);
  const all = new Set();
  for (const s of strings) for (const t of tokenize(s)) if (TOKEN.test(t)) all.add(t);
  const list = [...all];
  const css = design.candidatesToCss(list);
  const valid = new Set(list.filter((_, i) => css[i] !== null && css[i] !== ""));
  const unknown = new Set();
  for (const s of strings) {
    const tokens = tokenize(s).filter((t) => TOKEN.test(t));
    if (tokens.length === 0) continue;
    if (!s.certain) {
      // Prose, identifiers and paths: only flag when the string is mostly real classes.
      const good = tokens.filter((t) => valid.has(t) || allow.has(t)).length;
      if (tokens.length < 2 || good < tokens.length / 2 || good === tokens.length) continue;
    }
    for (const t of tokens) if (!valid.has(t) && !allow.has(t)) unknown.add(t);
  }
  return [...unknown].sort();
}

/** @returns {Promise<Map<string, string[]>>} unknown class -> files using it */
export async function findUnknownClasses(srcDir, cssPath, allow = ALLOWLIST) {
  const design = await loadDesign(cssPath);
  const perFile = new Map();
  for (const file of listSources(srcDir)) {
    const strings = extractClassStrings(readFileSync(file, "utf8"), file);
    perFile.set(file, unknownClasses(strings, design, allow));
  }
  const result = new Map();
  for (const [file, classes] of perFile)
    for (const c of classes) result.set(c, [...(result.get(c) ?? []), relative(srcDir, file)]);
  return result;
}
