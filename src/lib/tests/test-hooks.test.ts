import { describe, expect, it } from "vitest";
import { testHooksEnabled } from "../test-hooks";

const enabled = { E2E_TEST_HOOKS: "1", DATA_SOURCE: "mock", NODE_ENV: "development" };

describe("testHooksEnabled", () => {
  it("is on only with the opt-in, the mock data source and a non-production runtime", () => {
    expect(testHooksEnabled(enabled)).toBe(true);
    expect(testHooksEnabled({ ...enabled, NODE_ENV: "test" })).toBe(true);
  });

  it.each([
    ["no opt-in", { ...enabled, E2E_TEST_HOOKS: undefined }],
    ["opt-in not exactly 1", { ...enabled, E2E_TEST_HOOKS: "true" }],
    ["supabase data source", { ...enabled, DATA_SOURCE: "supabase" }],
    ["no data source", { ...enabled, DATA_SOURCE: undefined }],
    ["NODE_ENV production", { ...enabled, NODE_ENV: "production" }],
    ["APP_ENV production", { ...enabled, APP_ENV: "production" }],
  ])("is off with %s", (_name, env) => {
    expect(testHooksEnabled(env)).toBe(false);
  });
});
