// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { receiptFor } from "./gate.mjs";

const GATE_SCRIPT = resolve(import.meta.dirname, "gate.mjs");

describe("receiptFor", () => {
  const valid = {
    ok: true,
    headBefore: "abc1234",
    headAfter: "abc1234",
    dirtyBefore: false,
    dirtyAfter: false,
    steps: ["format:check", "lint", "typecheck", "test"],
    mode: "quick",
  };

  it("returns a receipt when ok, HEAD is unchanged, and the tree is clean before and after", () => {
    const receipt = receiptFor(valid);
    expect(receipt).toEqual({
      head: "abc1234",
      steps: ["format:check", "lint", "typecheck", "test"],
      mode: "quick",
      at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(receipt?.steps).not.toBe(valid.steps);
  });

  it("returns null when the gate did not pass", () => {
    expect(receiptFor({ ...valid, ok: false })).toBeNull();
  });

  it("returns null when HEAD moved or is missing", () => {
    expect(receiptFor({ ...valid, headAfter: "def5678" })).toBeNull();
    expect(receiptFor({ ...valid, headBefore: "", headAfter: "" })).toBeNull();
    expect(receiptFor({ ...valid, headBefore: null, headAfter: null })).toBeNull();
  });

  it("returns null when the working tree was dirty before or after", () => {
    expect(receiptFor({ ...valid, dirtyBefore: true })).toBeNull();
    expect(receiptFor({ ...valid, dirtyAfter: true })).toBeNull();
    expect(receiptFor({ ...valid, dirtyBefore: true, dirtyAfter: true })).toBeNull();
  });
});

// Each test runs the real gate.mjs, which starts `npm run` four times (~6 s): above the 5 s default.
describe("gate.mjs receipt writing", { timeout: 30_000 }, () => {
  let repo: string;
  let gitDir: string;
  const git = (args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

  const writePackageScripts = (exitCode: number) => {
    const cmd = `node -e "process.exit(${exitCode})"`;
    writeFileSync(
      join(repo, "package.json"),
      JSON.stringify(
        {
          name: "tmp-gate-test",
          private: true,
          scripts: {
            "format:check": cmd,
            lint: cmd,
            typecheck: cmd,
            test: cmd,
          },
        },
        null,
        2,
      ),
    );
  };

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "gate-receipt-test-"));
    git(["init", "-b", "main"]);
    git(["config", "user.name", "Test"]);
    git(["config", "user.email", "test@example.com"]);
    writePackageScripts(0);
    git(["add", "package.json"]);
    git(["commit", "-m", "chore: init"]);
    gitDir = git(["rev-parse", "--absolute-git-dir"]);
  });

  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it("writes gate-receipt.json in git-dir when clean and passing", () => {
    const receiptPath = join(gitDir, "gate-receipt.json");
    rmSync(receiptPath, { force: true, recursive: true });

    const res = spawnSync(process.execPath, [GATE_SCRIPT, "--quick", "--base", "HEAD"], {
      cwd: repo,
      encoding: "utf8",
    });

    expect(res.status).toBe(0);
    expect(existsSync(receiptPath)).toBe(true);
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    expect(receipt).toMatchObject({
      head: git(["rev-parse", "HEAD"]),
      steps: ["format:check", "lint", "typecheck", "test"],
      mode: "quick",
    });
  });

  it("does not write a receipt when the working tree is dirty", () => {
    const receiptPath = join(gitDir, "gate-receipt.json");
    rmSync(receiptPath, { force: true, recursive: true });
    writeFileSync(join(repo, "dirty.txt"), "uncommitted");

    const res = spawnSync(process.execPath, [GATE_SCRIPT, "--quick", "--base", "HEAD"], {
      cwd: repo,
      encoding: "utf8",
    });
    rmSync(join(repo, "dirty.txt"), { force: true });

    expect(res.status).toBe(0);
    expect(existsSync(receiptPath)).toBe(false);
  });

  it("prints a warning without changing exit code when writing the receipt fails", () => {
    const receiptPath = join(gitDir, "gate-receipt.json");
    rmSync(receiptPath, { force: true, recursive: true });
    // Creating a directory at the receipt path makes writeFileSync fail with EISDIR.
    mkdirSync(receiptPath);

    const res = spawnSync(process.execPath, [GATE_SCRIPT, "--quick", "--base", "HEAD"], {
      cwd: repo,
      encoding: "utf8",
    });
    rmSync(receiptPath, { recursive: true, force: true });

    expect(res.status).toBe(0);
    expect(res.stderr).toMatch(/warning/i);
  });

  it("does not write a receipt when a step fails", () => {
    const receiptPath = join(gitDir, "gate-receipt.json");
    rmSync(receiptPath, { force: true, recursive: true });
    writePackageScripts(1);
    git(["add", "package.json"]);
    git(["commit", "-m", "chore: fail script"]);

    const res = spawnSync(process.execPath, [GATE_SCRIPT, "--quick", "--base", "HEAD"], {
      cwd: repo,
      encoding: "utf8",
    });

    expect(res.status).toBe(1);
    expect(existsSync(receiptPath)).toBe(false);
  });
});
