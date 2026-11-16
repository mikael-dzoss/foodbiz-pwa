import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_AUTH_COOKIE_NAME } from "@/domain/auth";
import { updateSession } from "@/lib/supabase/proxy";

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(async () => NextResponse.next()),
}));

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATA_SOURCE", "mock");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["/manage/login", "/en", "/manage"])(
    "serves %s in mock mode without Supabase configuration or session refresh",
    async (path) => {
      const request = new NextRequest(`http://localhost:3000${path}`, {
        headers: { cookie: `${MOCK_AUTH_COOKIE_NAME}=active` },
      });

      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(updateSession).not.toHaveBeenCalled();
    },
  );

  it.each(["development", "production"])(
    "preserves Supabase session refresh in %s",
    async (nodeEnv) => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", nodeEnv);
      const refreshed = NextResponse.next();
      vi.mocked(updateSession).mockResolvedValueOnce(refreshed);
      const request = new NextRequest("http://localhost:3000/manage/login");

      expect(await proxy(request)).toBe(refreshed);
      expect(updateSession).toHaveBeenCalledWith(request);
    },
  );

  it("delegates /manage/orders to updateSession when DATA_SOURCE is supabase", async () => {
    vi.stubEnv("DATA_SOURCE", "supabase");
    vi.stubEnv("NODE_ENV", "development");
    const redirected = NextResponse.redirect(
      "http://localhost:3000/manage/login?next=%2Fmanage%2Forders",
    );
    vi.mocked(updateSession).mockResolvedValueOnce(redirected);

    const request = new NextRequest("http://localhost:3000/manage/orders");
    const response = await proxy(request);

    expect(updateSession).toHaveBeenCalledWith(request);
    expect(response).toBe(redirected);
  });

  it("rejects mock mode in production before redirecting or refreshing sessions", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest("http://localhost:3000/manage/orders");

    await expect(proxy(request)).rejects.toThrow("DATA_SOURCE cannot be 'mock' in production");
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("redirects to /manage/login when accessing /manage with missing mock cookie", async () => {
    const request = new NextRequest("http://localhost:3000/manage/orders");

    const response = await proxy(request);
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/manage/login?next=%2Fmanage%2Forders");
  });

  it("redirects to /manage/login when accessing /manage with signed-out mock cookie", async () => {
    const request = new NextRequest("http://localhost:3000/manage/orders", {
      headers: {
        cookie: `${MOCK_AUTH_COOKIE_NAME}=signed-out`,
      },
    });

    const response = await proxy(request);
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/manage/login?next=%2Fmanage%2Forders");
  });

  it("does not redirect /manage/login even if signed-out", async () => {
    const request = new NextRequest("http://localhost:3000/manage/login", {
      headers: {
        cookie: `${MOCK_AUTH_COOKIE_NAME}=signed-out`,
      },
    });

    const response = await proxy(request);
    expect(response.status).toBe(200);
  });

  it("allows /manage when mock session is active", async () => {
    const request = new NextRequest("http://localhost:3000/manage", {
      headers: {
        cookie: `${MOCK_AUTH_COOKIE_NAME}=active`,
      },
    });

    const response = await proxy(request);
    expect(response.status).toBe(200);
  });
});
