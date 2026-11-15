// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("local Supabase devcontainer and scripts (#118)", () => {
  it("enables docker-in-docker and forwards Supabase ports in .devcontainer/devcontainer.json", () => {
    const devcontainer = JSON.parse(
      readFileSync(resolve(root, ".devcontainer/devcontainer.json"), "utf8"),
    ) as {
      features?: Record<string, unknown>;
      forwardPorts?: number[];
    };

    expect(devcontainer.features).toHaveProperty(
      "ghcr.io/devcontainers/features/docker-in-docker:2",
    );
    expect(devcontainer.forwardPorts).toEqual(expect.arrayContaining([3000, 54321, 54323]));
  });

  it("includes supabase/config.toml with local API and Studio ports", () => {
    const configPath = resolve(root, "supabase/config.toml");
    expect(existsSync(configPath)).toBe(true);

    const configToml = readFileSync(configPath, "utf8");
    expect(configToml).toContain('project_id = "foodbiz-pwa"');
    expect(configToml).toContain("port = 54321");
    expect(configToml).toContain("port = 54323");
    expect(configToml).toContain('site_url = "http://localhost:3000"');
    expect(configToml).toContain(
      'additional_redirect_urls = ["http://localhost:3000/auth/callback**"]',
    );
    expect(configToml).toContain("[auth.email]");
    expect(configToml).toContain("enable_signup = false");
    expect(configToml).toContain("[auth.external.google]");
    expect(configToml).toContain('client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"');
    expect(configToml).toContain('secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"');
  });

  it("includes supabase/.env.example with empty OAuth variables", () => {
    const envExamplePath = resolve(root, "supabase/.env.example");
    expect(existsSync(envExamplePath)).toBe(true);

    const envContent = readFileSync(envExamplePath, "utf8");
    expect(envContent).toContain("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=");
    expect(envContent).toContain("SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=");
  });

  it("exposes db:start, db:stop, and db:reset npm scripts and supabase CLI", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(pkg.scripts).toMatchObject({
      "db:start": "supabase start",
      "db:stop": "supabase stop",
      "db:reset": "supabase db reset",
      "db:status": "supabase status",
    });
    expect(pkg.devDependencies).toHaveProperty("supabase");
  });
});
