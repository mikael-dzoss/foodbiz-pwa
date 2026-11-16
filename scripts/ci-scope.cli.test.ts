// @vitest-environment node
// Drives the CLI in throwaway git repositories: the push and PR modes depend on real git history.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve(__dirname, "ci-scope.mjs");

const makeRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "ci-scope-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
      cwd: dir,
      encoding: "utf8",
    }).trim();
  const commit = (file: string, message: string) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), `${message}\n`);
    git("add", "-A");
    git("commit", "-q", "-m", message);
    return git("rev-parse", "HEAD");
  };
  git("init", "-q", "-b", "develop");
  commit("README.md", "root");
  return { dir, git, commit };
};

const scope = (dir: string, ...args: string[]) =>
  JSON.parse(execFileSync("node", [SCRIPT, ...args], { cwd: dir, encoding: "utf8" })) as {
    tiers: Record<string, boolean>;
    check: Record<string, boolean>;
    files: string[];
    base: string;
    reason: string;
    expensive?: boolean;
  };

describe("--push", () => {
  it("skips re-running a merge whose tree equals the PR head already verified", () => {
    const { dir, git, commit } = makeRepo();
    const before = git("rev-parse", "HEAD");
    git("switch", "-q", "-c", "feature/a");
    commit("src/a.ts", "feature");
    git("switch", "-q", "develop");
    git("merge", "-q", "--no-ff", "-m", "merge", "feature/a");
    const result = scope(dir, "--push", before);
    expect(result.reason).toMatch(/already verified/);
    expect(result.check.formatOnly).toBe(true);
    expect(result.tiers.build).toBe(false);
  });

  it("judges the merge diff when develop moved after the PR's last run", () => {
    const { dir, git, commit } = makeRepo();
    git("switch", "-q", "-c", "feature/a");
    commit("src/a.ts", "feature");
    git("switch", "-q", "develop");
    const before = commit("docs/other.md", "someone else merged first");
    git("merge", "-q", "--no-ff", "-m", "merge", "feature/a");
    const result = scope(dir, "--push", before);
    expect(result.reason).toBe("merge diff (before..after)");
    expect(result.files).toEqual(["src/a.ts"]);
    expect(result.tiers.build).toBe(true);
  });

  it("fails safe to every tier when the before SHA is unknown (first push)", () => {
    const { dir, commit } = makeRepo();
    commit("docs/a.md", "plain commit");
    const zero = scope(dir, "--push", "0".repeat(40));
    expect(zero.reason).toBe("base unknown: every tier");
    expect(zero.tiers).toMatchObject({ build: true, e2e: true, db: true, journey: true });
  });
});

describe("--pr", () => {
  const stack = () => {
    const repo = makeRepo();
    repo.git("update-ref", "refs/remotes/origin/develop", "HEAD");
    repo.git("update-ref", "refs/remotes/origin/feature/0", "HEAD");
    repo.git("switch", "-q", "-c", "feature/1");
    repo.commit("src/one.ts", "one");
    repo.git("update-ref", "refs/remotes/origin/feature/1", "HEAD");
    repo.git("switch", "-q", "-c", "feature/2");
    repo.commit("docs/two.md", "two");
    repo.git("update-ref", "refs/remotes/origin/feature/2", "HEAD");
    return repo;
  };

  it("runs the expensive tiers for the bottom PR (base develop)", () => {
    const { dir, git } = stack();
    git("switch", "-q", "feature/1");
    const head = git("rev-parse", "HEAD");
    const result = scope(dir, "--pr", "develop", head, "feature/1");
    expect(result.expensive).toBe(true);
    expect(result.tiers.build).toBe(true);
  });

  it("defers them for a middle PR and judges only its own slice", () => {
    const { dir, git } = stack();
    git("switch", "-q", "feature/1");
    const head = git("rev-parse", "HEAD");
    // PR 1 is based on feature/0 (not protected) and its head is contained in origin/feature/2.
    const result = scope(dir, "--pr", "feature/0", head, "feature/1");
    expect(result.expensive).toBe(false);
    expect(result.files).toEqual(["src/one.ts"]);
    expect(result.tiers).toEqual({
      check: true,
      build: false,
      e2e: false,
      db: false,
      journey: false,
    });
    expect(result.reason).toMatch(/middle of a stack/);
  });

  it("judges the top PR against develop, so the whole stack counts", () => {
    const { dir, git } = stack();
    git("switch", "-q", "feature/2");
    const head = git("rev-parse", "HEAD");
    const result = scope(dir, "--pr", "feature/1", head, "feature/2");
    expect(result.expensive).toBe(true);
    expect(result.files).toEqual(["docs/two.md", "src/one.ts"]);
    expect(result.tiers.build).toBe(true);
  });
});
