import { afterEach, describe, expect, it, vi } from "vitest";
import PatternsLayout from "./layout";

vi.mock("server-only", () => ({}));
vi.mock("@/components/root-document", () => ({
  RootDocument: ({ children }: { children: unknown }) => children,
  rootMetadata: {},
  rootViewport: {},
}));

describe("patterns layout", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("404s in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    expect(() => PatternsLayout({ children: "x" })).toThrow();
  });

  it("renders children in test", () => {
    vi.stubEnv("APP_ENV", "test");
    expect(PatternsLayout({ children: "x" }).props.children).toBe("x");
  });
});
