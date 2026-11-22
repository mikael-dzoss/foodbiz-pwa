import { describe, expect, it } from "vitest";

function sRgbToLinear(c: number): number {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return 0.2126 * sRgbToLinear(r) + 0.7152 * sRgbToLinear(g) + 0.0722 * sRgbToLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

describe("Design tokens WCAG 2.2 AA Contrast", () => {
  const lightTokens = {
    background: "#f9f9ff",
    foreground: "#171c22",
    card: "#ffffff",
    cardForeground: "#171c22",
    muted: "#eef0f6",
    mutedForeground: "#4f5662",
    border: "#dde0e8",
    input: "#737a86",
    ring: "#006c49",
    primary: "#006c49",
    primaryForeground: "#ffffff",
    primarySoft: "#d3efe1",
    primarySoftForeground: "#00402a",
    secondary: "#855300",
    secondaryForeground: "#ffffff",
    warningSoft: "#fbe7cc",
    warningSoftForeground: "#5e3a00",
    info: "#005ac2",
    infoForeground: "#ffffff",
    destructive: "#ba1a1a",
    destructiveForeground: "#ffffff",
  };

  const darkTokens = {
    background: "#0f1417",
    foreground: "#e5e9ee",
    card: "#171d20",
    cardForeground: "#e5e9ee",
    muted: "#232a2e",
    mutedForeground: "#a4adb8",
    border: "#2c3439",
    input: "#7c8692",
    ring: "#5cd6a3",
    primary: "#5cd6a3",
    primaryForeground: "#00391f",
    primarySoft: "#0f3d2c",
    primarySoftForeground: "#b4f1d4",
    secondary: "#ffb95c",
    secondaryForeground: "#462a00",
    warningSoft: "#4a3510",
    warningSoftForeground: "#ffddb0",
    info: "#a9c7ff",
    infoForeground: "#002f68",
    destructive: "#ffb4ab",
    destructiveForeground: "#690005",
  };

  describe("Light theme contrast ratios", () => {
    it("satisfies WCAG AA text contrast (>= 4.5:1)", () => {
      expect(contrastRatio(lightTokens.foreground, lightTokens.background)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(lightTokens.mutedForeground, lightTokens.card)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(lightTokens.mutedForeground, lightTokens.muted)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrastRatio(lightTokens.primaryForeground, lightTokens.primary),
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lightTokens.primary, lightTokens.card)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(lightTokens.primarySoftForeground, lightTokens.primarySoft),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(lightTokens.secondaryForeground, lightTokens.secondary),
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lightTokens.infoForeground, lightTokens.info)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrastRatio(lightTokens.destructiveForeground, lightTokens.destructive),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(lightTokens.warningSoftForeground, lightTokens.warningSoft),
      ).toBeGreaterThanOrEqual(4.5);
    });

    it("satisfies WCAG non-text control contrast (>= 3:1)", () => {
      expect(contrastRatio(lightTokens.input, lightTokens.card)).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("Dark theme contrast ratios", () => {
    it("satisfies WCAG AA text contrast (>= 4.5:1)", () => {
      expect(contrastRatio(darkTokens.foreground, darkTokens.background)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(darkTokens.mutedForeground, darkTokens.card)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(darkTokens.mutedForeground, darkTokens.muted)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrastRatio(darkTokens.primaryForeground, darkTokens.primary),
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkTokens.primary, darkTokens.card)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(darkTokens.primarySoftForeground, darkTokens.primarySoft),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(darkTokens.secondaryForeground, darkTokens.secondary),
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkTokens.infoForeground, darkTokens.info)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(darkTokens.destructiveForeground, darkTokens.destructive),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(darkTokens.warningSoftForeground, darkTokens.warningSoft),
      ).toBeGreaterThanOrEqual(4.5);
    });

    it("satisfies WCAG non-text control contrast (>= 3:1)", () => {
      expect(contrastRatio(darkTokens.input, darkTokens.card)).toBeGreaterThanOrEqual(3.0);
    });
  });
});
