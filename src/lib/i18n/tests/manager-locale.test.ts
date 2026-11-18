import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get }) }));
// The suite-wide stub answers English; this file tests the real helper.
vi.mock("@/lib/i18n/manager-locale", async (importOriginal) => importOriginal());

import { getManagerLocale } from "../manager-locale";

describe("getManagerLocale", () => {
  beforeEach(() => get.mockReset());

  it("reads the foodbiz_locale cookie", async () => {
    get.mockReturnValue({ value: "fr" });
    expect(await getManagerLocale()).toBe("fr");
    expect(get).toHaveBeenCalledWith("foodbiz_locale");
  });

  it.each([[undefined], [{ value: "de" }], [{ value: "" }]])(
    "falls back to English for %j",
    async (cookie) => {
      get.mockReturnValue(cookie);
      expect(await getManagerLocale()).toBe("en");
    },
  );
});
