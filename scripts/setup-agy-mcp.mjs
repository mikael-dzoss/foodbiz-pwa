#!/usr/bin/env node
// Idempotent installer/migrator for Antigravity's `~/.gemini/config/mcp_config.json`.
//
// Wires Stitch through `scripts/stitch-mcp-bridge.mjs` using `env.STITCH_API_KEY` only (removing
// any legacy direct `serverUrl`/`headers` entry) and preserves unrelated MCP servers. Safe to run
// from `.devcontainer/post-create.sh` or manually on any new/clean host.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_TIMEOUT_MS, parseTimeoutMs } from "./stitch-mcp-bridge.mjs";

export const DEFAULT_CONFIG_PATH = join(homedir(), ".gemini", "config", "mcp_config.json");
export const DEFAULT_VERCEL_MCP_URL = "https://mcp.vercel.com";

/**
 * Pure config builder: merges the Stitch stdio bridge (and optional Vercel server) into an
 * existing Antigravity `mcp_config.json` object without mutating `existing`.
 * @param {Record<string, unknown> | null | undefined} existing
 * @param {{
 *   repoRoot: string,
 *   stitchApiKey?: string,
 *   vercelApiToken?: string,
 *   timeoutMs?: number,
 * }} options
 */
export function buildMcpConfig(
  existing,
  { repoRoot, stitchApiKey, vercelApiToken, timeoutMs = DEFAULT_TIMEOUT_MS },
) {
  const existingRoot = existing && typeof existing === "object" ? existing : {};
  const existingServers =
    existingRoot.mcpServers && typeof existingRoot.mcpServers === "object"
      ? /** @type {Record<string, Record<string, unknown>>} */ (existingRoot.mcpServers)
      : {};

  const nextServers = { ...existingServers };
  const warnings = [];

  const prevStitch = existingServers.stitch;
  const prevStitchEnv =
    prevStitch && typeof prevStitch.env === "object" && prevStitch.env !== null
      ? /** @type {Record<string, unknown>} */ (prevStitch.env)
      : {};
  const prevStitchHeaders =
    prevStitch && typeof prevStitch.headers === "object" && prevStitch.headers !== null
      ? /** @type {Record<string, unknown>} */ (prevStitch.headers)
      : {};

  const resolvedStitchKey =
    (typeof stitchApiKey === "string" && stitchApiKey.trim()) ||
    (typeof prevStitchEnv.STITCH_API_KEY === "string" && prevStitchEnv.STITCH_API_KEY.trim()) ||
    (typeof prevStitchHeaders["X-Goog-Api-Key"] === "string" &&
      prevStitchHeaders["X-Goog-Api-Key"].trim()) ||
    "";

  const bridgePath = resolve(repoRoot, "scripts", "stitch-mcp-bridge.mjs");
  const normalizedTimeout = parseTimeoutMs(timeoutMs, DEFAULT_TIMEOUT_MS);

  let configuredStitch = false;
  if (resolvedStitchKey) {
    nextServers.stitch = {
      disabled: false,
      command: "node",
      args: [bridgePath],
      env: {
        STITCH_API_KEY: resolvedStitchKey,
        STITCH_TIMEOUT_MS: String(normalizedTimeout),
      },
    };
    configuredStitch = true;
  } else {
    warnings.push(
      "STITCH_API_KEY is not set (and no existing Stitch key was found); skipped configuring Stitch MCP.",
    );
  }

  let configuredVercel = false;
  const trimmedVercel = typeof vercelApiToken === "string" ? vercelApiToken.trim() : "";
  if (trimmedVercel) {
    nextServers.vercel = {
      disabled: false,
      headers: {
        Authorization: `Bearer ${trimmedVercel}`,
      },
      serverUrl: DEFAULT_VERCEL_MCP_URL,
    };
    configuredVercel = true;
  }

  return {
    config: {
      ...existingRoot,
      mcpServers: nextServers,
    },
    configuredStitch,
    configuredVercel,
    bridgePath,
    warnings,
  };
}

/**
 * Reads, updates, and writes `~/.gemini/config/mcp_config.json` with `0600` permissions.
 * @param {{
 *   configPath?: string,
 *   repoRoot?: string,
 *   env?: Record<string, string | undefined>,
 *   timeoutMs?: number,
 * }} [options]
 */
export function installAgyMcp({
  configPath = DEFAULT_CONFIG_PATH,
  repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  env = process.env,
  timeoutMs,
} = {}) {
  let existing = {};
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf8").trim();
    if (raw) {
      existing = JSON.parse(raw);
    }
  }

  const effectiveTimeout = parseTimeoutMs(timeoutMs ?? env.STITCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const result = buildMcpConfig(existing, {
    repoRoot,
    stitchApiKey: env.STITCH_API_KEY,
    vercelApiToken: env.VERCEL_API_TOKEN,
    timeoutMs: effectiveTimeout,
  });

  if (result.configuredStitch || result.configuredVercel || !existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, `${JSON.stringify(result.config, null, 2)}\n`, { mode: 0o600 });
    chmodSync(configPath, 0o600);
  }

  return { ...result, configPath };
}

/**
 * Parses CLI flags: `--config <path>`, `--repo-root <path>`, `--timeout-ms <ms>`.
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const value = (flag) => {
    const idx = argv.indexOf(flag);
    return idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
  };
  return {
    configPath: value("--config"),
    repoRoot: value("--repo-root"),
    timeoutMs: value("--timeout-ms") ? parseTimeoutMs(value("--timeout-ms")) : undefined,
  };
}

const isMain =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const res = installAgyMcp({
    ...(args.configPath ? { configPath: resolve(args.configPath) } : {}),
    ...(args.repoRoot ? { repoRoot: resolve(args.repoRoot) } : {}),
    ...(args.timeoutMs !== undefined ? { timeoutMs: args.timeoutMs } : {}),
  });
  for (const warning of res.warnings) {
    process.stderr.write(`[setup-agy-mcp] Warning: ${warning}\n`);
  }
  const configured = [
    res.configuredStitch ? `stitch (stdio -> ${res.bridgePath})` : null,
    res.configuredVercel ? "vercel" : null,
  ].filter(Boolean);
  if (configured.length > 0) {
    process.stdout.write(`[setup-agy-mcp] Updated ${res.configPath}: ${configured.join(", ")}\n`);
  }
}
