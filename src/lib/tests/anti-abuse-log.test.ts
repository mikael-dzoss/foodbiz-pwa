import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashIdentifier,
  logAntiAbuseRejection,
  type AntiAbuseRejectionEvent,
} from "../anti-abuse-log";

describe("hashIdentifier", () => {
  it("is deterministic per process and distinguishes inputs", () => {
    const h1 = hashIdentifier("+33612345678");
    const h2 = hashIdentifier("+33612345678");
    const h3 = hashIdentifier("+33612345679");

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("logAntiAbuseRejection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs rejection without any unmasked personal data", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const event: AntiAbuseRejectionEvent = {
      reason: "honeypot",
      ip: "192.168.1.50",
      phone: "+33612345678",
    };

    logAntiAbuseRejection(event);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [msg, payload] = warnSpy.mock.calls[0];
    expect(msg).toContain("[anti-abuse]");
    expect(JSON.stringify(payload)).not.toContain("192.168.1.50");
    expect(JSON.stringify(payload)).not.toContain("+33612345678");
    expect(payload).toHaveProperty("reason", "honeypot");
    expect(payload).toHaveProperty("ipHash");
    expect(payload).toHaveProperty("phoneHash");
  });
});
