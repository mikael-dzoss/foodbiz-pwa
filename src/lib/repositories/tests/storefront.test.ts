// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const { createSupabaseRepositories } = vi.hoisted(() => ({
  createSupabaseRepositories: vi.fn(() => ({ marker: "supabase" })),
}));
vi.mock("../supabase", () => ({ createSupabaseRepositories }));
vi.mock("@/lib/supabase/server", () => ({ createPublicServerClient: () => ({}) }));

import { getMockRepositories } from "../mock";
import { DEMO_BUSINESS_ID } from "../mock/fixtures/business";
import { getStorefrontBusinessId, getStorefrontRepositories } from "../storefront";

const CONFIGURED_ID = "22222222-2222-4222-8222-222222222222";

describe("storefront repositories", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    createSupabaseRepositories.mockClear();
  });

  it("uses cookie-less public-only Supabase repositories in supabase mode", () => {
    vi.stubEnv("DATA_SOURCE", "supabase");
    vi.stubEnv("STOREFRONT_BUSINESS_ID", CONFIGURED_ID);
    getStorefrontRepositories();
    expect(createSupabaseRepositories).toHaveBeenCalledWith(expect.any(Function), {
      publicOnly: true,
    });
  });

  it("uses the mock repositories in mock mode", () => {
    vi.stubEnv("DATA_SOURCE", "mock");
    expect(getStorefrontRepositories()).toBe(getMockRepositories());
    expect(createSupabaseRepositories).not.toHaveBeenCalled();
  });

  it("resolves the business from STOREFRONT_BUSINESS_ID, defaulting to the demo business in mock mode", () => {
    vi.stubEnv("DATA_SOURCE", "supabase");
    vi.stubEnv("STOREFRONT_BUSINESS_ID", CONFIGURED_ID);
    expect(getStorefrontBusinessId()).toBe(CONFIGURED_ID);

    vi.stubEnv("DATA_SOURCE", "mock");
    vi.stubEnv("STOREFRONT_BUSINESS_ID", "");
    expect(getStorefrontBusinessId()).toBe(DEMO_BUSINESS_ID);
  });
});
