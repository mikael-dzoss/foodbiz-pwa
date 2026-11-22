interface TestHookEnv {
  readonly DATA_SOURCE?: string;
  readonly NODE_ENV?: string;
  readonly APP_ENV?: string;
  readonly E2E_TEST_HOOKS?: string;
}

/**
 * Whether the e2e-only hooks (`/api/test/*`) may answer. Every condition must hold: the mock data
 * source (which the env schema already forbids in production), a non-production runtime, and the
 * explicit opt-in set only by playwright.config.ts. Anything else is a plain 404.
 */
export function testHooksEnabled(env: TestHookEnv): boolean {
  return (
    env.E2E_TEST_HOOKS === "1" &&
    env.DATA_SOURCE === "mock" &&
    env.NODE_ENV !== "production" &&
    env.APP_ENV !== "production"
  );
}
