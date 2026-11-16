// @vitest-environment node
import { describe, expect, it } from "vitest";
import { scopeFor } from "./ci-scope.mjs";
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
      [],
    ]) {
      expect(tiers(...files), files.join()).toEqual({
        check: true,
        build: false,
        e2e: false,
        db: false,
        formatOnly: true,
        dbTypes: false,
        tooling: false,
      });
    }
  });

  it("src changes need check, build and e2e but not db or tooling", () => {
    expect(tiers("src/features/orders/list.tsx")).toEqual({
      check: true,
      build: true,
      e2e: true,
      db: false,
      formatOnly: false,
      dbTypes: false,
      tooling: false,
    });
  });

  it("supabase changes need db and the generated-types check, not build", () => {
    expect(tiers("supabase/migrations/20260101_x.sql")).toEqual({
      check: true,
      build: false,
      e2e: false,
      db: true,
      formatOnly: false,
      dbTypes: true,
      tooling: false,
    });
  });

  it("workflow changes need the tooling tests only", () => {
    expect(tiers(".github/workflows/ci.yml")).toEqual({
      check: true,
      build: false,
      e2e: false,
      db: false,
      formatOnly: false,
      dbTypes: false,
      tooling: true,
    });
  });

  it("a lockfile change needs build, e2e and db", () => {
    expect(tiers("package-lock.json")).toMatchObject({ build: true, e2e: true, db: true });
    expect(tiers("package.json")).toMatchObject({ build: true, e2e: true, db: true });
  });

  it("e2e specs only trigger e2e", () => {
    expect(tiers("e2e/storefront.spec.ts")).toMatchObject({ build: false, e2e: true });
    expect(tiers("playwright.config.ts")).toMatchObject({ build: false, e2e: true });
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
      ".agents/skills/issue-logger/scripts/gh_issue.py",
      ".claude/hooks/guard-git.mjs",
    ]) {
      expect(tiers(file).tooling, file).toBe(true);
    }
  });

  it("a docs change mixed with code is not format-only", () => {
    expect(tiers("README.md", "src/app/page.tsx")).toMatchObject({
      formatOnly: false,
      build: true,
    });
  });
});

describe("plan", () => {
  const names = (scope: ReturnType<typeof scopeFor>, mode?: "auto" | "quick" | "full") =>
    plan(scope, mode).flatMap((t) => t.steps.map((s) => s.name));

  it("docs-only runs format:check alone", () => {
    expect(names(scopeFor(["docs/a.md"]))).toEqual(["format:check"]);
  });

  it("quick runs format, lint, typecheck and unit tests", () => {
    expect(names(scopeFor(["src/a.ts"]), "quick")).toEqual([
      "format:check",
      "lint",
      "typecheck",
      "test",
    ]);
  });

  it("orders tiers check, db, build, e2e", () => {
    expect(plan(scopeFor(["package-lock.json"])).map((t) => t.tier)).toEqual([
      "check",
      "db",
      "build",
      "e2e",
    ]);
  });

  it("full runs everything", () => {
    expect(names(scopeFor([]), "full")).toEqual([
      "format:check",
      "lint",
      "typecheck",
      "db:types:check",
      "test:coverage",
      "test:tooling",
      "db:test+live",
      "build",
      "test:e2e",
    ]);
  });

  it("adds db:types:check and test:tooling only when relevant", () => {
    expect(names(scopeFor(["supabase/migrations/x.sql"]))).toContain("db:types:check");
    expect(names(scopeFor(["scripts/gate.mjs"]))).toContain("test:tooling");
    expect(names(scopeFor(["src/a.ts"]))).not.toContain("test:tooling");
  });
});
