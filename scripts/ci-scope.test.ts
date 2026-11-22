// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  deferExpensive,
  needsIntegration,
  outputLines,
  prPolicy,
  resolveBase,
  scopeFor,
} from "./ci-scope.mjs";
import { plan } from "./gate.mjs";

const tiers = (...files: string[]) => {
  const { tiers: t, check } = scopeFor(files);
  return { ...t, ...check };
};

describe("scopeFor", () => {
  it("docs and markdown only need a format check", () => {
    for (const files of [
      ["docs/CONTRIBUTING.md"],
      ["README.md", "docs/design/DESIGN_SYSTEM.md"],
      [".agents/skills/ship/SKILL.md"],
      [".github/pull_request_template.md"],
      [],
    ]) {
      expect(tiers(...files), files.join()).toEqual({
        check: true,
        build: false,
        e2e: false,
        db: false,
        journey: false,
        formatOnly: true,
        unit: false,
        dbTypes: false,
        tooling: false,
      });
    }
  });

  it("src changes need check, build, journey and e2e but not db or tooling", () => {
    expect(tiers("src/features/orders/list.tsx")).toEqual({
      check: true,
      build: true,
      e2e: true,
      db: false,
      journey: true,
      formatOnly: false,
      unit: true,
      dbTypes: false,
      tooling: false,
    });
  });

  it("supabase changes need db, journey and the generated-types check, not build or e2e", () => {
    expect(tiers("supabase/migrations/20260101_x.sql")).toEqual({
      check: true,
      build: false,
      e2e: false,
      db: true,
      journey: true,
      formatOnly: false,
      unit: false,
      dbTypes: true,
      tooling: false,
    });
  });

  it("other workflow files need the tooling tests only", () => {
    for (const file of [".github/workflows/promote.yml", ".github/dependabot.yml"]) {
      expect(tiers(file), file).toEqual({
        check: true,
        build: false,
        e2e: false,
        db: false,
        journey: false,
        formatOnly: false,
        unit: false,
        dbTypes: false,
        tooling: true,
      });
    }
  });

  it("ci.yml and the scope script run every tier (the only proof an edit to them works)", () => {
    for (const file of [".github/workflows/ci.yml", "scripts/ci-scope.mjs"]) {
      expect(tiers(file), file).toEqual({
        check: true,
        build: true,
        e2e: true,
        db: true,
        journey: true,
        formatOnly: false,
        unit: true,
        dbTypes: true,
        tooling: true,
      });
    }
  });

  it("a lockfile change needs build, e2e, db and journey", () => {
    expect(tiers("package-lock.json")).toMatchObject({
      build: true,
      e2e: true,
      db: true,
      journey: true,
    });
    expect(tiers("package.json")).toMatchObject({ build: true, e2e: true, db: true });
  });

  it("e2e specs only trigger e2e", () => {
    expect(tiers("e2e/storefront.spec.ts")).toMatchObject({
      build: false,
      e2e: true,
      journey: false,
    });
    expect(tiers("playwright.config.ts")).toMatchObject({ build: false, e2e: true });
  });

  it("supabase-mode journey files only trigger the journey", () => {
    for (const file of [
      "e2e-supabase/storefront-checkout.spec.ts",
      "playwright.supabase.config.ts",
      "scripts/e2e-supabase.mjs",
      "scripts/build-local.mjs",
    ]) {
      expect(tiers(file), file).toMatchObject({
        journey: true,
        build: false,
        e2e: false,
        db: false,
      });
    }
  });

  it("repository and Supabase client code triggers db", () => {
    for (const file of [
      "src/lib/repositories/factory.ts",
      "src/lib/supabase/server.ts",
      "src/domain/repositories/types.ts",
      "src/lib/supabase/database.types.ts",
    ]) {
      expect(tiers(file).db, file).toBe(true);
    }
    expect(tiers("src/lib/supabase/database.types.ts").dbTypes).toBe(true);
  });

  it("tooling paths trigger the tooling tests", () => {
    for (const file of [
      "scripts/gate.mjs",
      "scripts/secret-scan.mjs",
      ".agents/skills/issue-logger/scripts/gh_issue.py",
      ".claude/hooks/guard-git.mjs",
      ".husky/pre-commit",
    ]) {
      expect(tiers(file).tooling, file).toBe(true);
    }
  });

  it("scripts-only changes need no expensive tier and no unit tests", () => {
    const scope = scopeFor(["scripts/gate.mjs", "scripts/gate.test.ts"]);
    expect(needsIntegration(scope)).toBe(false);
    expect(scope.tiers.e2e).toBe(false);
    expect(scope.check.unit).toBe(false);
  });

  it("only src, package, vitest and TypeScript config changes need the unit tests", () => {
    for (const file of ["src/a.ts", "package-lock.json", "vitest.config.mts", "tsconfig.json"])
      expect(scopeFor([file]).check.unit, file).toBe(true);
    for (const file of ["e2e/a.spec.ts", "supabase/seed.sql", ".github/workflows/promote.yml"])
      expect(scopeFor([file]).check.unit, file).toBe(false);
  });

  it("a docs change mixed with code is not format-only", () => {
    expect(tiers("README.md", "src/app/page.tsx")).toMatchObject({
      formatOnly: false,
      build: true,
    });
  });

  it("`all` forces every tier (unknown base, manual run)", () => {
    expect(scopeFor([], { all: true })).toEqual({
      files: [],
      tiers: { check: true, build: true, e2e: true, db: true, journey: true },
      check: { formatOnly: false, unit: true, dbTypes: true, tooling: true },
    });
  });
});

describe("integration and deferral", () => {
  it("integration is needed for build, db or journey changes only", () => {
    expect(needsIntegration(scopeFor(["docs/a.md"]))).toBe(false);
    expect(needsIntegration(scopeFor(["e2e/a.spec.ts"]))).toBe(false);
    expect(needsIntegration(scopeFor(["supabase/migrations/x.sql"]))).toBe(true);
    expect(needsIntegration(scopeFor(["src/app/page.tsx"]))).toBe(true);
  });

  it("deferExpensive switches the expensive tiers off and remembers they were needed", () => {
    const deferred = deferExpensive(scopeFor(["src/app/page.tsx"]));
    expect(deferred.tiers).toEqual({
      check: true,
      build: false,
      e2e: false,
      db: false,
      journey: false,
    });
    expect(deferred.deferred).toBe(true);
    expect(deferExpensive(scopeFor(["docs/a.md"])).deferred).toBe(false);
    // The cheap-tier flags are untouched.
    expect(deferExpensive(scopeFor(["scripts/a.mjs"])).check.tooling).toBe(true);
  });

  it("outputLines flattens the scope for $GITHUB_OUTPUT", () => {
    const lines = outputLines(scopeFor(["supabase/migrations/x.sql"]), { base: "abc" });
    expect(lines).toEqual(
      expect.arrayContaining([
        "check=true",
        "integration=true",
        "int_db=true",
        "int_build=false",
        "int_journey=true",
        "e2e=false",
        "format_only=false",
        "unit=false",
        "db_types=true",
        "tooling=false",
        "deferred=false",
        "files=1",
        "base=abc",
      ]),
    );
  });
});

describe("prPolicy (stack awareness)", () => {
  it("PRs onto a protected branch always run the expensive tiers against that branch", () => {
    for (const baseRef of ["develop", "staging", "main"]) {
      expect(prPolicy({ baseRef, otherBranchesContainingHead: ["origin/feature/next"] })).toEqual({
        expensive: true,
        base: `origin/${baseRef}`,
        reason: `base is ${baseRef}`,
      });
    }
  });

  it("a PR on a feature branch with nothing stacked above it is the top: expensive, judged vs develop", () => {
    const policy = prPolicy({ baseRef: "feature/1-a", otherBranchesContainingHead: [] });
    expect(policy).toMatchObject({ expensive: true, base: "origin/develop" });
  });

  it("a PR with a branch stacked above it is the middle: check only, judged vs its parent", () => {
    const policy = prPolicy({
      baseRef: "feature/1-a",
      otherBranchesContainingHead: ["origin/feature/3-c"],
    });
    expect(policy).toMatchObject({ expensive: false, base: "origin/feature/1-a" });
    expect(policy.reason).toContain("origin/feature/3-c");
  });
});

describe("resolveBase", () => {
  it("returns undefined for empty, all-zero or unknown refs so callers fail safe", () => {
    expect(resolveBase(undefined)).toBeUndefined();
    expect(resolveBase("")).toBeUndefined();
    expect(resolveBase("0000000000000000000000000000000000000000")).toBeUndefined();
    expect(resolveBase("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef")).toBeUndefined();
  });

  it("resolves HEAD to itself", () => {
    expect(resolveBase("HEAD")).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe("plan", () => {
  const names = (
    scope: ReturnType<typeof scopeFor>,
    mode?: "auto" | "quick" | "full",
    options?: { base?: string },
  ) => plan(scope, mode, options).flatMap((t) => t.steps.map((s) => s.name));

  it("docs-only runs the secret scan and format:check alone", () => {
    expect(names(scopeFor(["docs/a.md"]))).toEqual(["secret-scan", "format:check"]);
  });

  it("quick runs format, lint, typecheck and unit tests", () => {
    expect(names(scopeFor(["src/a.ts"]), "quick")).toEqual([
      "format:check",
      "lint",
      "typecheck",
      "test",
    ]);
  });

  it("orders tiers check, integration, e2e", () => {
    expect(plan(scopeFor(["package-lock.json"])).map((t) => t.tier)).toEqual([
      "check",
      "integration",
      "e2e",
    ]);
  });

  it("skips the unit tests when nothing they import changed", () => {
    expect(names(scopeFor(["scripts/gate.mjs"]))).not.toContain("test:coverage");
    expect(names(scopeFor(["src/a.ts"]))).toContain("test:coverage");
  });

  it("full runs everything, in CI order", () => {
    expect(names(scopeFor([]), "full")).toEqual([
      "secret-scan",
      "format:check",
      "lint",
      "typecheck",
      "db:types:check",
      "test:coverage",
      "audit",
      "test:tooling",
      "supabase",
      "db:test",
      "test:live",
      "build:local",
      "test:e2e:supabase",
      "test:e2e",
    ]);
  });

  it("a src change builds against local Supabase and runs the journey, but not pgTAP", () => {
    const steps = names(scopeFor(["src/app/page.tsx"]));
    expect(steps).toEqual(
      expect.arrayContaining(["supabase", "build:local", "test:e2e:supabase", "test:e2e"]),
    );
    expect(steps).not.toContain("db:test");
    expect(steps).not.toContain("test:live");
  });

  it("a migration runs pgTAP, live tests and the journey, but neither build nor mock e2e", () => {
    const steps = names(scopeFor(["supabase/migrations/x.sql"]));
    expect(steps).toEqual(
      expect.arrayContaining(["db:test", "test:live", "test:e2e:supabase", "db:types:check"]),
    );
    expect(steps).not.toContain("build:local");
    expect(steps).not.toContain("test:e2e");
  });

  it("an e2e-only change runs the mock suite without starting Supabase", () => {
    const steps = names(scopeFor(["e2e/a.spec.ts"]));
    expect(steps).toContain("test:e2e");
    expect(steps).not.toContain("supabase");
  });

  it("adds db:types:check and test:tooling only when relevant", () => {
    expect(names(scopeFor(["supabase/migrations/x.sql"]))).toContain("db:types:check");
    expect(names(scopeFor(["scripts/gate.mjs"]))).toContain("test:tooling");
    expect(names(scopeFor(["src/a.ts"]))).not.toContain("test:tooling");
  });

  it("scans the diff against the base when one is given, the staged diff otherwise", () => {
    const cmd = (options?: { base?: string }) =>
      plan(scopeFor(["docs/a.md"]), "auto", options)[0].steps[0].cmd;
    expect(cmd()).toEqual(["node", "scripts/secret-scan.mjs"]);
    expect(cmd({ base: "abc123" })).toEqual([
      "node",
      "scripts/secret-scan.mjs",
      "--base",
      "abc123",
    ]);
  });
});
