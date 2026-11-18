// @vitest-environment node
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decide } from "./agy-guard.mjs";

const root = resolve(import.meta.dirname, "..");
const base = { cwd: root, workspacePaths: [root] };
const command = (CommandLine: string) => ({
  ...base,
  toolCall: { name: "run_command", args: { CommandLine } },
});
const file = (name: string, path: string) => ({
  ...base,
  toolCall: { name, args: { Path: path, Content: "x" } },
});

describe("decide: run_command", () => {
  it.each([
    "npm run gate:quick",
    "git status && git diff --stat",
    "cat .env.example",
    'node -e "console.log(process.env.HOME)"',
    "cat .envrc",
  ])("passes %s", (cmd) => {
    expect(decide(command(cmd))).toEqual({});
  });

  it.each([
    ["git commit --no-verify -m x", /--no-verify/],
    ["git push origin develop", /protected branch 'develop'/],
    ["git push --force origin feature/x", /plain force-push/],
    ["cat .env", /secrets file/],
    ["cp .env.local /tmp/x", /secrets file/],
    ["gh pr merge 12 --squash", /orchestrator merges/],
  ])("denies %s", (cmd, reason) => {
    const result = decide(command(cmd));
    expect(result).toMatchObject({ decision: "deny", reason: expect.stringMatching(reason) });
    expect(result.reason).toMatch(/^Blocked by scripts\/agy-guard\.mjs: /);
  });
});

describe("decide: file tools", () => {
  it("passes ordinary reads and writes, including relative paths", () => {
    expect(decide(file("read_file", join(root, "package.json")))).toEqual({});
    expect(decide(file("write_file", join(root, "src/app/page.tsx")))).toEqual({});
    expect(decide(file("edit_file", "src/app/page.tsx"))).toEqual({});
    expect(decide(file("read_file", join(root, ".env.example")))).toEqual({});
  });

  it("denies .env reads and protected writes via guard-files.sh", () => {
    expect(decide(file("read_file", join(root, ".env.local")))).toMatchObject({ decision: "deny" });
    expect(
      decide(file("write_file", join(root, "src/lib/supabase/database.types.ts"))),
    ).toMatchObject({
      decision: "deny",
      reason: expect.stringContaining("generated file"),
    });
    expect(decide(file("edit_file", join(root, "src/middleware.ts")))).toMatchObject({
      decision: "deny",
    });
  });

  it("ignores calls without paths or commands", () => {
    expect(
      decide({ ...base, toolCall: { name: "search_web", args: { Query: "zod v4" } } }),
    ).toEqual({});
  });
});

describe("decide: payload", () => {
  it("fails closed on an unreadable payload", () => {
    expect(decide(null)).toMatchObject({
      decision: "deny",
      reason: expect.stringContaining("failing closed"),
    });
    expect(decide({ toolCall: {} })).toMatchObject({ decision: "deny" });
  });

  it("falls back to cwd when workspacePaths is missing", () => {
    expect(
      decide({ cwd: root, toolCall: { name: "run_command", args: { CommandLine: "ls" } } }),
    ).toEqual({});
  });
});

describe("CLI", () => {
  const run = (input: string) =>
    spawnSync(process.execPath, [join(root, "scripts/agy-guard.mjs")], { input, encoding: "utf8" });

  it("prints the decision as JSON on stdout", () => {
    expect(JSON.parse(run(JSON.stringify(command("git push origin main"))).stdout)).toMatchObject({
      decision: "deny",
    });
    expect(JSON.parse(run(JSON.stringify(command("echo hi"))).stdout)).toEqual({});
    expect(JSON.parse(run("not json").stdout)).toMatchObject({ decision: "deny" });
  });
});
