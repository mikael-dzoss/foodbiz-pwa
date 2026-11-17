import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestError, requestErrorFields } from "@/instrumentation";

type Args = Parameters<typeof onRequestError>;

const request: Args[1] = {
  path: "/fr/order/tk-secret?phone=0612345678",
  method: "GET",
  headers: { cookie: "sb-access-token=abc", authorization: "Bearer xyz" },
};
const context: Args[2] = {
  routerKind: "App Router",
  routePath: "/[locale]/order/[token]",
  routeType: "render",
  renderSource: "server-rendering",
  revalidateReason: undefined,
};

function dbError(): Error {
  const err = new Error("duplicate key (phone)=(0612345678)");
  return Object.assign(err, { digest: "123456" });
}

describe("requestErrorFields", () => {
  it("logs the route template, never the concrete path, query, headers or cookies", () => {
    const fields = requestErrorFields(dbError(), request, context, true);
    expect(fields).toMatchObject({
      errorName: "Error",
      digest: "123456",
      method: "GET",
      routePath: "/[locale]/order/[token]",
      routeType: "render",
    });
    const text = JSON.stringify(fields);
    for (const secret of ["tk-secret", "0612345678", "sb-access-token", "Bearer"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("adds message and a truncated stack outside production only", () => {
    const err = dbError();
    err.stack = "x".repeat(5000);
    const dev = requestErrorFields(err, request, context, false);
    expect(dev.message).toContain("duplicate key");
    expect(String(dev.stack)).toHaveLength(2000);
    expect(requestErrorFields(err, request, context, true)).not.toHaveProperty("message");
  });

  it("handles non-Error values", () => {
    expect(requestErrorFields("boom", request, context, false)).toMatchObject({
      errorName: "string",
      digest: undefined,
    });
  });
});

describe("onRequestError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    ["production", undefined, false],
    ["production", "staging", false],
    ["production", "test", true],
    ["development", undefined, true],
  ])("NODE_ENV=%s APP_ENV=%s includes message: %s", async (nodeEnv, appEnv, withMessage) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    if (appEnv) vi.stubEnv("APP_ENV", appEnv);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await onRequestError(dbError(), request, context);
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.event).toBe("request_error");
    expect("message" in line).toBe(withMessage);
  });
});
