// @vitest-environment node
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const hook = (name: string) => join(root, ".claude/hooks", name);

interface HookResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(
  name: string,
  payload: unknown,
  env: Record<string, string | undefined> = {},
): HookResult {
  const result = spawnSync("bash", [hook(name)], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const bashCall = (command: string) => ({ tool_input: { command } });
const editCall = (file: string) => ({ tool_input: { file_path: join(root, file) } });

let scratch: string;
let protectedRepo: string;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "claude-hooks-"));
  protectedRepo = join(scratch, "repo");
  spawnSync("git", ["init", "-q", "-b", "develop", protectedRepo]);
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("guard-git.sh", () => {
  it.each([
    ["git commit -m x", 0],
    ["git commit --no-verify -m x", 2],
    ["git push origin develop", 2],
    ["git push origin HEAD:main", 2],
    ["git push origin staging", 2],
    ["git push -u origin utils/claude-code-setup", 0],
    ["git push --force origin utils/x", 2],
    ["git push -f", 2],
    ["git push --force-with-lease origin feature/1-x-develop", 0],
    ["npm run lint", 0],
  ])("%s → exit %i", (command, expected) => {
    expect(run("guard-git.sh", bashCall(command), { CLAUDE_PROJECT_DIR: scratch }).status).toBe(
      expected,
    );
  });

  it("blocks commits while the checkout is on a protected branch", () => {
    const result = run("guard-git.sh", bashCall("git commit -m x"), {
      CLAUDE_PROJECT_DIR: protectedRepo,
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("'develop' is protected");
  });

  it("falls back to the payload cwd (Copilot) when CLAUDE_PROJECT_DIR is unset", () => {
    const payload = { ...bashCall("git commit -m x"), cwd: protectedRepo };
    expect(run("guard-git.sh", payload, { CLAUDE_PROJECT_DIR: undefined }).status).toBe(2);
  });
});

describe("guard-files.sh", () => {
  it.each([
    [".env.local", 2],
    [".env", 2],
    ["supabase/.env", 2],
    ["certs/key.pem", 2],
    ["src/middleware.ts", 2],
    ["src/lib/supabase/database.types.ts", 2],
    ["graphify-out/graph.json", 2],
    [".env.example", 0],
    ["src/app/page.tsx", 0],
    ["src/proxy.ts", 0],
  ])("%s → exit %i", (file, expected) => {
    expect(run("guard-files.sh", editCall(file)).status).toBe(expected);
  });

  it("accepts Copilot's filePath + cwd payload", () => {
    const payload = { tool_input: { filePath: join(root, ".env.local") }, cwd: root };
    const result = run("guard-files.sh", payload, { CLAUDE_PROJECT_DIR: undefined });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(".env.local: secrets file");
  });

  it("ignores payloads without a file path", () => {
    expect(run("guard-files.sh", { tool_input: {} }).status).toBe(0);
  });
});

describe("format.sh", () => {
  it("formats the edited file with the repo's Prettier", () => {
    const file = join(scratch, "probe.ts");
    writeFileSync(file, "const   x = {a:1}\nexport default x\n");
    expect(run("format.sh", { tool_input: { file_path: file } }).status).toBe(0);
    expect(readFileSync(file, "utf8")).toContain("const x = { a: 1 };");
  });

  it("skips unsupported extensions and missing files", () => {
    const file = join(scratch, "notes.txt");
    writeFileSync(file, "a   b\n");
    expect(run("format.sh", { tool_input: { file_path: file } }).status).toBe(0);
    expect(readFileSync(file, "utf8")).toBe("a   b\n");
    expect(run("format.sh", { tool_input: { file_path: join(scratch, "nope.ts") } }).status).toBe(
      0,
    );
  });
});

describe("session-context.sh", () => {
  let fakeBin: string;

  beforeAll(() => {
    fakeBin = join(scratch, "bin");
    spawnSync("mkdir", ["-p", fakeBin]);
    const gh = join(fakeBin, "gh");
    writeFileSync(
      gh,
      '#!/usr/bin/env bash\necho "Order filter [OPEN] labels: type: story, gate: needs-review"\n',
    );
    chmodSync(gh, 0o755);
  });

  const env = (branch: string) => ({
    SESSION_CONTEXT_BRANCH: branch,
    PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
  });

  it("prints the issue and its labels for feature/bug branches", () => {
    const result = run("session-context.sh", {}, env("feature/42-order-status-filter"));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("issue #42");
    expect(result.stdout).toContain(
      "#42 Order filter [OPEN] labels: type: story, gate: needs-review",
    );
  });

  it("stays silent on branches without an issue number", () => {
    for (const branch of ["utils/claude-code-setup", "develop", "feature/no-number"]) {
      const result = run("session-context.sh", {}, env(branch));
      expect(result.status).toBe(0);
      expect(result.stdout).toBe("");
    }
  });
});

describe("graphify-update.sh", () => {
  it("is a no-op when the project has no graph", () => {
    const result = run("graphify-update.sh", {}, { CLAUDE_PROJECT_DIR: scratch });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });
});
