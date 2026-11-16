// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  const result = spawnSync(name.endsWith(".mjs") ? process.execPath : "bash", [hook(name)], {
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
let featureRepo: string;
let worktree: string;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "claude-hooks-"));
  protectedRepo = join(scratch, "repo");
  featureRepo = join(scratch, "feature");
  worktree = join(scratch, "wt");
  const git = (cwd: string, ...args: string[]) =>
    spawnSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
      { cwd },
    );
  spawnSync("git", ["init", "-q", "-b", "develop", protectedRepo]);
  git(protectedRepo, "commit", "-q", "--allow-empty", "-m", "init");
  git(protectedRepo, "branch", "feature/x");
  spawnSync("git", ["clone", "-q", protectedRepo, featureRepo]);
  git(featureRepo, "switch", "-q", "-c", "feature/y");
  git(protectedRepo, "worktree", "add", "-q", "-b", "utils/wt", worktree);
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("guard-git.mjs", () => {
  const guard = (command: string, repo = featureRepo, extra: Record<string, unknown> = {}) =>
    run("guard-git.mjs", { ...bashCall(command), cwd: repo, ...extra });
  const verdict = (command: string, repo = featureRepo) =>
    guard(command, repo).status === 2 ? "blocked" : "allowed";

  it.each([
    // plain commands
    ["npm run lint", "allowed"],
    ["git commit -m x", "allowed"],
    ["git push -u origin utils/agent-workflow", "allowed"],
    // protected pushes
    ["git push origin develop", "blocked"],
    ["git push origin staging", "blocked"],
    ["git push origin HEAD:main", "blocked"],
    ["git push origin HEAD:refs/heads/main", "blocked"],
    ["git push origin feature/x:develop", "blocked"],
    ["git push origin :main", "blocked"],
    ["git push --all origin", "blocked"],
    ["git push origin HEAD", "allowed"],
    ["git push origin develop:feature/x", "allowed"],
    ["git push origin feature/1-x-develop", "allowed"],
    // force flags
    ["git push -f", "blocked"],
    ["git push --force origin utils/x", "blocked"],
    ["git push -uf origin feature/x", "blocked"],
    ["git push origin +feature/x", "blocked"],
    ["git push --force-with-lease origin feature/x", "allowed"],
    ["git push --force-with-lease=feature/x:abc origin feature/x", "allowed"],
    ["git push --force-with-lease origin develop", "blocked"],
    ["git push --force-with-lease origin HEAD:refs/heads/main", "blocked"],
    // skipping hooks
    ["git commit --no-verify -m x", "blocked"],
    ["git commit -nm x", "blocked"],
    ["git push --no-verify origin feature/x", "blocked"],
    ["git merge --no-verify feature/x", "blocked"],
    // segments are judged separately
    ["git push -u origin feature/x && gh pr create --base develop --title x", "allowed"],
    ["git push origin feature/x && rm -f tmp", "allowed"],
    ["git push origin feature/x; rm -rf -f tmp", "allowed"],
    ["grep -r -- --no-verify .", "allowed"],
    ["echo 'git push origin main'", "allowed"],
    ["git status && git push origin main", "blocked"],
    ["git status | cat\ngit push origin main", "blocked"],
    ["bash -c 'git push origin main'", "blocked"],
    ["echo $(git push origin main)", "blocked"],
    ['git commit -m "fix: do not push to main && -f"', "allowed"],
    ["git commit -F - <<'EOF'\ngit push origin main\nEOF", "allowed"],
    ["git commit -m \"$(cat <<'EOF'\nfeat: x\n\ngit push -f\nEOF\n)\"", "allowed"],
    ["FOO=1 git push origin main", "blocked"],
    ["git -c user.name=x push origin main", "blocked"],
  ])("%s -> %s", (command, expected) => {
    expect(verdict(command.replaceAll("\\n", "\n"))).toBe(expected);
  });

  it("blocks commit, merge and bare push on a protected branch", () => {
    for (const command of [
      "git commit -m x",
      "git merge feature/x",
      "git push",
      "git push origin",
    ]) {
      const result = guard(command, protectedRepo);
      expect(result.status, command).toBe(2);
      expect(result.stderr).toContain("protected");
    }
  });

  it("allows read and branch-creating commands on a protected branch", () => {
    for (const command of ["git status", "git pull origin develop", "git switch -c feature/x"]) {
      expect(verdict(command, protectedRepo), command).toBe("allowed");
    }
  });

  it("follows branch switches inside one command", () => {
    expect(verdict("git switch -c feature/z && git commit -m x", protectedRepo)).toBe("allowed");
    expect(verdict("git checkout -b bug/1-y && git commit -m x", protectedRepo)).toBe("allowed");
    expect(verdict("git switch feature/x && git commit -m x", protectedRepo)).toBe("allowed");
    expect(verdict("git switch develop && git commit -m x")).toBe("blocked");
    expect(verdict("git checkout develop; git merge feature/x")).toBe("blocked");
  });

  it("uses the directory the command runs in (cd, git -C, worktrees)", () => {
    expect(verdict(`cd ${protectedRepo} && git commit -m x`)).toBe("blocked");
    expect(verdict(`git -C ${protectedRepo} commit -m x`)).toBe("blocked");
    expect(verdict(`git -C ${featureRepo} commit -m x`, protectedRepo)).toBe("allowed");
    expect(verdict(`cd ${featureRepo} && git commit -m x`, protectedRepo)).toBe("allowed");
    expect(verdict("git commit -m x", worktree)).toBe("allowed");
  });

  it("falls back to CLAUDE_PROJECT_DIR when the payload has no cwd", () => {
    const result = run("guard-git.mjs", bashCall("git commit -m x"), {
      CLAUDE_PROJECT_DIR: protectedRepo,
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("'develop' is protected");
  });

  it("does not need jq", () => {
    const bin = join(scratch, "nojq");
    mkdirSync(bin);
    for (const tool of ["git"]) {
      symlinkSync(execFileSync("which", [tool], { encoding: "utf8" }).trim(), join(bin, tool));
    }
    const payload = { ...bashCall("git push origin main"), cwd: featureRepo };
    expect(run("guard-git.mjs", payload, { PATH: bin }).status).toBe(2);
  });

  it("fails closed on an unreadable payload", () => {
    const result = spawnSync("node", [hook("guard-git.mjs")], {
      input: "not json",
      encoding: "utf8",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("failing closed");
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

  it("fails closed when jq is missing", () => {
    const bin = join(scratch, "nojq-files");
    mkdirSync(bin);
    symlinkSync(execFileSync("which", ["bash"], { encoding: "utf8" }).trim(), join(bin, "bash"));
    const result = run("guard-files.sh", editCall(".env"), { PATH: bin });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("jq is required");
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
      '#!/usr/bin/env bash\necho "Order filter [OPEN] labels: type: story, status: planned"\n',
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
    expect(result.stdout).toContain("#42 Order filter [OPEN] labels: type: story, status: planned");
  });

  it("handles any <type>/<number>-slug branch", () => {
    const result = run("session-context.sh", {}, env("utils/77-agent-workflow"));
    expect(result.stdout).toContain("issue #77");
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
