import { describe, expect, it } from "vitest";
import { enDictionary, frDictionary, interpolate } from "../i18n";
import { formatNumber, formatPercent } from "../formatting";

function paths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => paths(child, `${prefix}.${key}`));
  }
  return [];
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("dictionaries", () => {
  it("define the same keys in English and French", () => {
    expect(paths(frDictionary)).toEqual(paths(enDictionary));
  });

  it("keep the same {placeholders} in both languages", () => {
    const en = strings(enDictionary);
    const fr = strings(frDictionary);
    expect(fr).toHaveLength(en.length);
    en.forEach((text, index) => {
      const names = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(names(fr[index]), `${text} / ${fr[index]}`).toEqual(names(text));
    });
  });
});

describe("interpolate", () => {
  it("fills known placeholders and leaves unknown ones", () => {
    expect(interpolate("{count} of {max} {nope}", { count: 2, max: 3 })).toBe("2 of 3 {nope}");
  });
});

describe("number formatting", () => {
  it("formats percentages and numbers per locale", () => {
    expect(formatPercent(12.4, "en")).toBe("12.4%");
    expect(formatPercent(12.4, "fr").replace(/\s/g, " ")).toBe("12,4 %");
    expect(formatNumber(1234.5, "fr").replace(/\s/g, " ")).toBe("1 234,5");
  });
});
