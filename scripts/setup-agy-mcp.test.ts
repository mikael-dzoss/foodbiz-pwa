// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildMcpConfig, installAgyMcp, parseArgs } from "./setup-agy-mcp.mjs";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "setup-agy-mcp-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("parseArgs", () => {
  it("parses --config, --repo-root, and --timeout-ms flags", () => {
    expect(
      parseArgs([
        "--config",
        "/tmp/mcp.json",
        "--repo-root",
        "/workspaces/foodbiz-pwa",
        "--timeout-ms",
        "150000",
      ]),
    ).toEqual({
      configPath: "/tmp/mcp.json",
      repoRoot: "/workspaces/foodbiz-pwa",
      timeoutMs: 150_000,
    });
  });
});

describe("buildMcpConfig", () => {
  it("creates a clean-host config using env.STITCH_API_KEY only and preserves unrelated servers", () => {
    const existing = {
      mcpServers: {
        custom: { command: "echo", args: ["hi"] },
      },
    };
    const res = buildMcpConfig(existing, {
      repoRoot: "/workspaces/foodbiz-pwa",
      stitchApiKey: "test-stitch-api-key",
      vercelApiToken: "test-vercel-token",
      timeoutMs: 180_000,
    });

    expect(res.configuredStitch).toBe(true);
    expect(res.configuredVercel).toBe(true);
    expect(res.warnings).toEqual([]);
    expect(res.config.mcpServers.custom).toEqual({ command: "echo", args: ["hi"] });
    expect(res.config.mcpServers.stitch).toEqual({
      disabled: false,
      command: "node",
      args: ["/workspaces/foodbiz-pwa/scripts/stitch-mcp-bridge.mjs"],
      env: {
        STITCH_API_KEY: "test-stitch-api-key",
        STITCH_TIMEOUT_MS: "180000",
      },
    });
    expect(res.config.mcpServers.vercel).toEqual({
      disabled: false,
      headers: { Authorization: "Bearer test-vercel-token" },
      serverUrl: "https://mcp.vercel.com",
    });
  });

  it("migrates legacy serverUrl + X-Goog-Api-Key headers into env.STITCH_API_KEY", () => {
    const legacy = {
      mcpServers: {
        stitch: {
          disabled: false,
          serverUrl: "https://stitch.googleapis.com/mcp",
          headers: { "X-Goog-Api-Key": "test-legacy-stitch-key" },
        },
      },
    };

    const res = buildMcpConfig(legacy, {
      repoRoot: "/workspaces/foodbiz-pwa",
      timeoutMs: 180_000,
    });

    expect(res.configuredStitch).toBe(true);
    expect(res.config.mcpServers.stitch).toEqual({
      disabled: false,
      command: "node",
      args: ["/workspaces/foodbiz-pwa/scripts/stitch-mcp-bridge.mjs"],
      env: {
        STITCH_API_KEY: "test-legacy-stitch-key",
        STITCH_TIMEOUT_MS: "180000",
      },
    });
    expect("serverUrl" in (res.config.mcpServers.stitch as Record<string, unknown>)).toBe(false);
    expect("headers" in (res.config.mcpServers.stitch as Record<string, unknown>)).toBe(false);
  });

  it("warns cleanly without failing when STITCH_API_KEY is absent on a clean host", () => {
    const res = buildMcpConfig({}, { repoRoot: "/workspaces/foodbiz-pwa" });
    expect(res.configuredStitch).toBe(false);
    expect(res.warnings).toHaveLength(1);
    expect(res.config.mcpServers).toEqual({});
  });
});

describe("installAgyMcp", () => {
  it("creates parent directories, writes 0600 permissions, and is idempotent", () => {
    const dir = makeTempDir();
    const configPath = join(dir, "nested", "mcp_config.json");

    const first = installAgyMcp({
      configPath,
      repoRoot: "/workspaces/foodbiz-pwa",
      env: { STITCH_API_KEY: "test-stitch-api-key", STITCH_TIMEOUT_MS: "180000" },
    });
    expect(first.configuredStitch).toBe(true);

    const mode = statSync(configPath).mode & 0o777;
    expect(mode).toBe(0o600);
    const firstContent = readFileSync(configPath, "utf8");

    const second = installAgyMcp({
      configPath,
      repoRoot: "/workspaces/foodbiz-pwa",
      env: { STITCH_API_KEY: "test-stitch-api-key", STITCH_TIMEOUT_MS: "180000" },
    });
    expect(second.configuredStitch).toBe(true);
    expect(readFileSync(configPath, "utf8")).toBe(firstContent);
  });

  it("preserves unrelated entries when updating an existing file", () => {
    const dir = makeTempDir();
    const configPath = join(dir, "mcp_config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          stitch: {
            disabled: false,
            serverUrl: "https://stitch.googleapis.com/mcp",
            headers: { "X-Goog-Api-Key": "test-old-key" },
          },
          other: { disabled: false, serverUrl: "https://example.com/mcp" },
        },
      }),
    );

    installAgyMcp({
      configPath,
      repoRoot: "/workspaces/foodbiz-pwa",
      env: { STITCH_API_KEY: "test-new-key" },
    });

    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(parsed.mcpServers.other).toEqual({
      disabled: false,
      serverUrl: "https://example.com/mcp",
    });
    expect(parsed.mcpServers.stitch).toEqual({
      disabled: false,
      command: "node",
      args: ["/workspaces/foodbiz-pwa/scripts/stitch-mcp-bridge.mjs"],
      env: {
        STITCH_API_KEY: "test-new-key",
        STITCH_TIMEOUT_MS: "180000",
      },
    });
  });
});
