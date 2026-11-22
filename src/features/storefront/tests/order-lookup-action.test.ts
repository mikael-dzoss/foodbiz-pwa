import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMockRepositories } from "@/lib/repositories/mock";
import { demoGuests } from "@/lib/repositories/mock/fixtures";
import { getGlobalRateLimiter } from "@/lib/rate-limiter";
import { INITIAL_ORDER_LOOKUP_STATE } from "@/domain/order-lookup";
import { lookupOrderAction } from "../order-lookup-action";

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  // The real one rethrows Next control-flow errors; this stub's redirect throws a REDIRECT: error.
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Error && err.message.startsWith("REDIRECT:")) throw err;
  },
}));

let mockClientIp: string | null = "203.0.113.7";
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => (key.toLowerCase() === "x-forwarded-for" ? mockClientIp : null),
  })),
}));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

// Demo order #36 belongs to the first demo guest.
const firstGuestLocalPhone = demoGuests[0]
  .phone!.replace(/^\+33/, "0")
  .replace(/(\d{2})(?=\d)/g, "$1 ");
const VALID = { locale: "fr", phone: firstGuestLocalPhone, orderNumber: "36" };

describe("lookupOrderAction (#230)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientIp = "203.0.113.7";
    getMockRepositories().reset();
    getGlobalRateLimiter().reset();
  });

  it("redirects to the tracking page when phone and order number match", async () => {
    await expect(lookupOrderAction(INITIAL_ORDER_LOOKUP_STATE, form(VALID))).rejects.toThrow(
      "REDIRECT:/fr/order/tk-36",
    );
  });

  it("returns the same generic error for a wrong phone or an unknown order", async () => {
    const wrongPhone = await lookupOrderAction(
      INITIAL_ORDER_LOOKUP_STATE,
      form({ ...VALID, phone: "06 99 99 99 99" }),
    );
    const unknownOrder = await lookupOrderAction(
      INITIAL_ORDER_LOOKUP_STATE,
      form({ ...VALID, orderNumber: "999999" }),
    );
    expect(wrongPhone).toEqual({
      status: "error",
      code: "NOT_FOUND",
      values: { phone: "06 99 99 99 99", orderNumber: "36" },
    });
    expect(unknownOrder).toMatchObject({ status: "error", code: "NOT_FOUND" });
    expect(JSON.stringify(unknownOrder)).not.toContain("tk-");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("rejects invalid input and unparseable phones", async () => {
    await expect(
      lookupOrderAction(INITIAL_ORDER_LOOKUP_STATE, form({ ...VALID, orderNumber: "abc" })),
    ).resolves.toMatchObject({ code: "INVALID" });
    await expect(
      lookupOrderAction(INITIAL_ORDER_LOOKUP_STATE, form({ ...VALID, phone: "abcdefgh" })),
    ).resolves.toMatchObject({ code: "INVALID" });
  });

  it("treats a filled honeypot as a miss and falls back to the default locale", async () => {
    await expect(
      lookupOrderAction(INITIAL_ORDER_LOOKUP_STATE, form({ ...VALID, website: "spam" })),
    ).resolves.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      lookupOrderAction(INITIAL_ORDER_LOOKUP_STATE, form({ ...VALID, locale: "xx" })),
    ).rejects.toThrow("REDIRECT:/en/order/tk-36");
  });

  it("rate-limits repeated attempts per phone", async () => {
    mockClientIp = null;
    const attempt = () =>
      lookupOrderAction(INITIAL_ORDER_LOOKUP_STATE, form({ ...VALID, orderNumber: "999998" }));
    for (let i = 0; i < 5; i++)
      await expect(attempt()).resolves.toMatchObject({ code: "NOT_FOUND" });
    await expect(attempt()).resolves.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("rate-limits repeated attempts per IP", async () => {
    const attempt = (i: number) =>
      lookupOrderAction(
        INITIAL_ORDER_LOOKUP_STATE,
        form({ ...VALID, phone: `06 12 34 56 ${String(10 + i)}`, orderNumber: "999998" }),
      );
    for (let i = 0; i < 10; i++)
      await expect(attempt(i)).resolves.toMatchObject({ code: "NOT_FOUND" });
    await expect(attempt(20)).resolves.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("throws to the error boundary on an unexpected failure instead of showing a miss", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(
      getMockRepositories().orders,
      "findTrackingTokenByTicketAndPhone",
    ).mockRejectedValueOnce(new Error("db down"));
    await expect(lookupOrderAction(INITIAL_ORDER_LOOKUP_STATE, form(VALID))).rejects.toThrow(
      "Order lookup failed",
    );
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });
});
