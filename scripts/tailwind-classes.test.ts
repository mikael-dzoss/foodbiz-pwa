import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  extractClassStrings,
  findUnknownClasses,
  loadDesign,
  unknownClasses,
} from "./tailwind-classes.mjs";

const css = new URL("../src/app/globals.css", import.meta.url).pathname;
let design: Awaited<ReturnType<typeof loadDesign>>;

const unknownIn = (code: string) => unknownClasses(extractClassStrings(code), design);

beforeAll(async () => {
  design = await loadDesign(css);
}, 20_000);

describe("unknown Tailwind class detection", () => {
  it("passes real utilities, tokens, variants and arbitrary values", () => {
    const code = `export const A = () => <div className="bg-primary text-title-lg md:flex data-[state=open]:animate-fade-in w-[3px] pb-safe-4 text-caption" />;`;
    expect(unknownIn(code)).toEqual([]);
  });

  it("detects a class Tailwind does not generate", () => {
    const code = `export const A = () => <p className="text-danger flex">x</p>;`;
    expect(unknownIn(code)).toEqual(["text-danger"]);
  });

  it("looks inside cn(), conditionals and template literals", () => {
    const code = [
      "export const A = (p: boolean) => (",
      '  <p className={cn("flex", p && "font-headline", `border-divider ${p ? "px-2" : "py-0.2"}`)} />',
      ");",
    ].join("\n");
    expect(unknownIn(code)).toEqual(["border-divider", "font-headline", "py-0.2"]);
  });

  it("ignores prose, data strings and comparisons", () => {
    const code = [
      'const msg = "this is not a class list";',
      'if (status === "paid") {}',
      'export const A = () => <p data-testid="text-danger" className={cn(s === "all" && "flex")} />;',
    ].join("\n");
    expect(unknownIn(code)).toEqual([]);
  });

  it("catches a typo in a variant map but not in unrelated word lists", () => {
    const code = [
      'const styles = { a: "bg-primary text-primry-foreground px-2", b: "foo bar baz" };',
    ].join("\n");
    expect(unknownIn(code)).toEqual(["text-primry-foreground"]);
  });

  it("honours the allowlist for intentional marker classes", () => {
    const code = `export const A = () => <p className="peer group dark my-marker" />;`;
    expect(unknownIn(code)).toEqual(["my-marker"]);
  });

  it("scans a source tree and reports the files using each unknown class", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tw-check-"));
    mkdirSync(join(dir, "tests"));
    writeFileSync(join(dir, "ok.tsx"), `export const A = () => <p className="flex" />;`);
    writeFileSync(join(dir, "bad.tsx"), `export const A = () => <p className="text-nope" />;`);
    writeFileSync(
      join(dir, "tests", "skip.tsx"),
      `export const A = () => <p className="text-skip" />;`,
    );
    const result = await findUnknownClasses(dir, css);
    expect([...result]).toEqual([["text-nope", ["bad.tsx"]]]);
  });

  it("reports no unknown classes in the real source tree", async () => {
    const src = new URL("../src", import.meta.url).pathname;
    expect([...(await findUnknownClasses(src, css)).keys()]).toEqual([]);
  }, 20_000);
});
