import { describe, expect, it, vi } from "vitest";
import { getRepositories } from "../factory";

describe("getRepositories factory", () => {
  it("returns mock adapter when DATA_SOURCE is mock", () => {
    const repos = getRepositories("mock");
    expect(repos).toBeDefined();
    expect(repos.products).toBeDefined();
    expect(repos.categories).toBeDefined();
    expect(repos.orders).toBeDefined();
    expect(repos.guests).toBeDefined();
    expect(repos.expenses).toBeDefined();
    expect(repos.business).toBeDefined();
    expect(repos.members).toBeDefined();
  });

  it("reads default from getServerEnv when no argument is passed", () => {
    vi.stubEnv("DATA_SOURCE", "mock");
    vi.stubEnv("NODE_ENV", "development");
    try {
      const repos = getRepositories();
      expect(repos).toBeDefined();
      expect(repos.products).toBeDefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("throws for supabase adapter pending E18 implementation", () => {
    expect(() => getRepositories("supabase")).toThrow(
      /Supabase repository adapter is not yet implemented/,
    );
  });
});
