import { describe, expect, it, vi } from "vitest";

const connection = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("next/server", () => ({ connection }));

import { getRequestNow } from "../request-time";

describe("getRequestNow (#168)", () => {
  it("defers to request time with connection() before reading the clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T22:30:00Z"));
    try {
      const now = await getRequestNow();
      expect(connection).toHaveBeenCalledTimes(1);
      expect(now.toISOString()).toBe("2026-10-09T22:30:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });
});
