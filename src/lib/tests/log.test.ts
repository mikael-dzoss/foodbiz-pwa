import { afterEach, describe, expect, it, vi } from "vitest";
import { logEvent } from "@/lib/log";

describe("logEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("writes one JSON line on the writer matching the level and drops undefined fields", () => {
    vi.stubEnv("APP_ENV", "staging");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logEvent("error", "boom", { a: 1, b: undefined });
    logEvent("warn", "careful");
    logEvent("info", "hello");

    expect(error).toHaveBeenCalledTimes(1);
    const line = JSON.parse(error.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: "error", event: "boom", appEnv: "staging", a: 1 });
    expect(line).not.toHaveProperty("b");
    expect(Number.isNaN(Date.parse(line.time))).toBe(false);
    expect(JSON.parse(warn.mock.calls[0][0] as string).level).toBe("warn");
    expect(JSON.parse(info.mock.calls[0][0] as string).event).toBe("hello");
  });
});
