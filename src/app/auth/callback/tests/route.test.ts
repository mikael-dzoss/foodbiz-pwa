import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { MOCK_MANAGER_SESSION } from "@/domain/auth";

const mockExchangeCodeForSession = vi.fn();
const mockCreateClient = vi.fn(() => ({
  auth: {
    exchangeCodeForSession: mockExchangeCodeForSession,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockGetManagerSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getManagerSession: () => mockGetManagerSession(),
}));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetManagerSession.mockResolvedValue(MOCK_MANAGER_SESSION);
  });

  it("exchanges valid code for session and redirects to default /manage", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const request = new NextRequest("http://localhost:3000/auth/callback?code=valid-auth-code");
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-auth-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/manage");
  });

  it("exchanges valid code and redirects to sanitized safe next path", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=valid-auth-code&next=%2Fmanage%2Forders%3Fstatus%3DNEW",
    );
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/manage/orders?status=NEW");
  });

  it("sanitizes malicious open-redirect next target to /manage", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=valid-auth-code&next=%2F%2Fevil.com",
    );
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/manage");
  });

  it("redirects to login with auth_failed error if code is missing", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback");
    const response = await GET(request);

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/manage/login?error=auth_failed",
    );
  });

  it("redirects to login with auth_failed when exchangeCodeForSession fails", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      error: new Error("Invalid or expired authorization code"),
    });

    const request = new NextRequest("http://localhost:3000/auth/callback?code=expired-code");
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("expired-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/manage/login?error=auth_failed",
    );
  });

  it("redirects to login with denied error when access_denied is returned", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback?error=access_denied");
    const response = await GET(request);

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/manage/login?error=denied",
    );
  });

  it("redirects to login with cancelled error when cancellation is detected in description", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?error=access_denied&error_description=User+cancelled+sign-in",
    );
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/manage/login?error=cancelled",
    );
  });

  it("redirects to login with no_access error when forbidden/unauthorized", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback?error=forbidden");
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/manage/login?error=no_access",
    );
  });

  it("redirects to login with no_access when code exchange succeeds but user has no manager membership", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mockGetManagerSession.mockResolvedValueOnce(null);

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=valid-auth-code&next=%2Fmanage%2Forders",
    );
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-auth-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/manage/login?error=no_access",
    );
  });
});
