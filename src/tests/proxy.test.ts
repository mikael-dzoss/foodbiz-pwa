import { describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { NextRequest, NextResponse } from "next/server";
import { MOCK_AUTH_COOKIE_NAME } from "@/domain/auth";

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(async () => NextResponse.next()),
}));

describe("proxy", () => {
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
