import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "../proxy";

const mockGetClaims = vi.fn();
let registeredCookieHandlers: {
  getAll: () => Array<{ name: string; value: string }>;
  setAll: (
    cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
  ) => void;
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => {
    registeredCookieHandlers = options.cookies;
    return {
      auth: {
        getClaims: mockGetClaims,
      },
    };
  }),
}));

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  });

  it("redirects unauthenticated /manage route to /manage/login with next param", async () => {
    mockGetClaims.mockResolvedValueOnce({ data: { claims: null }, error: null });

    const request = new NextRequest("http://localhost:3000/manage/orders");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/manage/login?next=%2Fmanage%2Forders",
    );
  });

  it("does not redirect /manage/login when claims are missing", async () => {
    mockGetClaims.mockResolvedValueOnce({ data: { claims: null }, error: null });

    const request = new NextRequest("http://localhost:3000/manage/login");
    const response = await updateSession(request);

    expect(response.status).toBe(200);
  });

  it("does not redirect storefront route when claims are missing", async () => {
    mockGetClaims.mockResolvedValueOnce({ data: { claims: null }, error: null });

    const request = new NextRequest("http://localhost:3000/en/cart");
    const response = await updateSession(request);

    expect(response.status).toBe(200);
  });

  it("allows /manage access when claims are present", async () => {
    mockGetClaims.mockResolvedValueOnce({
      data: { claims: { sub: "user-123", email: "manager@foodbiz.app" } },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/manage/orders");
    const response = await updateSession(request);

    expect(response.status).toBe(200);
  });

  it("propagates cookies set during session refresh on redirect", async () => {
    mockGetClaims.mockImplementationOnce(async () => {
      registeredCookieHandlers.setAll([
        { name: "sb-auth-token", value: "refreshed-token", options: { path: "/" } },
      ]);
      return { data: { claims: null }, error: null };
    });

    const request = new NextRequest("http://localhost:3000/manage/dashboard");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.cookies.get("sb-auth-token")?.value).toBe("refreshed-token");
  });

  it("propagates cookies set during session refresh on normal response", async () => {
    mockGetClaims.mockImplementationOnce(async () => {
      registeredCookieHandlers.setAll([
        { name: "sb-auth-token", value: "refreshed-token", options: { path: "/" } },
      ]);
      return { data: { claims: { sub: "user-123" } }, error: null };
    });

    const request = new NextRequest("http://localhost:3000/en/catalog");
    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(response.cookies.get("sb-auth-token")?.value).toBe("refreshed-token");
  });
});
