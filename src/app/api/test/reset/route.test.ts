import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMockRepositories } from "@/lib/repositories/mock";
import { DEMO_BUSINESS_ID } from "@/lib/repositories/mock/fixtures";
import { POST } from "./route";

describe("POST /api/test/reset", () => {
  beforeEach(() => {
    vi.stubEnv("DATA_SOURCE", "mock");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_TEST_HOOKS", "1");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("restores the seed data when enabled", async () => {
    const { expenses } = getMockRepositories();
    const seeded = (await expenses.list(DEMO_BUSINESS_ID)).length;
    await expenses.create(DEMO_BUSINESS_ID, {
      amount: 1,
      date: "2026-10-09",
      description: "reset me",
    });
    expect((await expenses.list(DEMO_BUSINESS_ID)).length).toBe(seeded + 1);

    expect(POST().status).toBe(204);
    expect((await expenses.list(DEMO_BUSINESS_ID)).length).toBe(seeded);
  });

  it.each([
    ["production", { NODE_ENV: "production" }],
    ["no opt-in", { E2E_TEST_HOOKS: "" }],
    ["supabase", { DATA_SOURCE: "supabase" }],
  ])("answers 404 and leaves the data alone (%s)", async (_name, env) => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const { expenses } = getMockRepositories();
    await expenses.create(DEMO_BUSINESS_ID, {
      amount: 2,
      date: "2026-10-09",
      description: "keep me",
    });
    const before = (await expenses.list(DEMO_BUSINESS_ID)).length;

    expect(POST().status).toBe(404);
    expect((await expenses.list(DEMO_BUSINESS_ID)).length).toBe(before);
    getMockRepositories().reset();
  });
});
