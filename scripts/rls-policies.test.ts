// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

const TABLES = [
  "businesses",
  "business_members",
  "business_settings",
  "product_categories",
  "products",
  "guests",
  "orders",
  "order_items",
  "expenses",
] as const;

describe("RLS policies and pgTAP test suite (#120)", () => {
  it("defines RLS policies, membership helpers, and tracking RPCs in 20260101000001_rls_policies.sql", () => {
    const migrationPath = resolve(root, "supabase/migrations/20260101000001_rls_policies.sql");
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    // 1. All 9 tables have RLS explicitly enabled
    for (const table of TABLES) {
      expect(sql).toMatch(
        new RegExp(`alter\\s+table\\s+${table}\\s+enable\\s+row\\s+level\\s+security;`, "i"),
      );
    }

    // 2. Membership and ownership helpers
    expect(sql).toMatch(/create\s+(?:or\s+replace\s+)?function\s+public\.is_business_member\s*\(/i);
    expect(sql).toMatch(/create\s+(?:or\s+replace\s+)?function\s+auth\.is_business_member\s*\(/i);
    expect(sql).toMatch(/create\s+(?:or\s+replace\s+)?function\s+public\.is_business_owner\s*\(/i);
    expect(sql).toContain("(select auth.uid())");
    expect(sql).toContain("security definer");

    // 3. Policies defined for tables
    for (const table of TABLES) {
      expect(sql).toMatch(new RegExp(`create\\s+policy\\s+${table}_`, "i"));
    }

    // Anon read restrictions
    expect(sql).toContain("products_select_anon");
    expect(sql).toContain("visible = true");

    // Storefront and order tracking RPCs
    expect(sql).toMatch(
      /create\s+(?:or\s+replace\s+)?function\s+public\.get_order_by_tracking_token\s*\(/i,
    );
    expect(sql).toMatch(
      /create\s+(?:or\s+replace\s+)?function\s+public\.lookup_order_by_ticket_and_phone\s*\(/i,
    );
    expect(sql).toMatch(
      /create\s+(?:or\s+replace\s+)?function\s+public\.storefront_order_tracking_token\s*\(/i,
    );
    expect(sql).toMatch(
      /create\s+(?:or\s+replace\s+)?function\s+public\.storefront_featured_products\s*\(/i,
    );

    // Explicit execution grants to anon and authenticated
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.get_order_by_tracking_token/i);
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.lookup_order_by_ticket_and_phone/i,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.storefront_order_tracking_token/i,
    );
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.storefront_featured_products/i);
  });

  it("provides comprehensive pgTAP test suite in supabase/tests/rls_policies.test.sql", () => {
    const testPath = resolve(root, "supabase/tests/rls_policies.test.sql");
    expect(existsSync(testPath)).toBe(true);

    const testSql = readFileSync(testPath, "utf8");

    // Transaction isolation and pgTAP structure
    expect(testSql).toMatch(/\bbegin;/i);
    expect(testSql).toMatch(/select\s+plan\(\d+\);/i);
    expect(testSql).toMatch(/select\s+\*\s+from\s+finish\(\);/i);
    expect(testSql).toMatch(/\brollback;/i);

    // Tests RLS enabled on all 9 tables
    for (const table of TABLES) {
      expect(testSql).toMatch(new RegExp(`relname\\s*=\\s*'${table}'`, "i"));
    }

    // Role switching and context testing
    expect(testSql).toContain("set local role anon;");
    expect(testSql).toContain("set local role authenticated;");
    expect(testSql).toContain("request.jwt.claim.sub");
    expect(testSql).toContain("request.jwt.claims");

    // Anon assertions
    expect(testSql).toContain("anon can read businesses");
    expect(testSql).toContain("anon sees only visible products");
    expect(testSql).toContain("anon cannot read guests directly");
    expect(testSql).toContain("anon cannot read orders directly");
    expect(testSql).toContain("anon cannot insert products");
    expect(testSql).toContain("anon cannot insert expenses");
    expect(testSql).toContain("anon can track order via tracking token");
    expect(testSql).toContain("tracking token RPC omits guest name and phone");

    // Authenticated member assertions
    expect(testSql).toContain("member_a is recognized as member of Biz A");
    expect(testSql).toContain("member_a is not recognized as member of Biz B");
    expect(testSql).toContain("member_a can read both visible and hidden products of Biz A");
    expect(testSql).toContain("member_a cannot read hidden products of Biz B");
    expect(testSql).toContain("member_a cannot read guests of Biz B");
    expect(testSql).toContain("member_a cannot read orders of Biz B");
    expect(testSql).toContain("member_a can insert product into Biz A");
    expect(testSql).toContain("member_a cannot insert product into Biz B");
  });

  it("exposes db:test npm script and runs pgTAP tests in CI workflow", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["db:test"]).toBe("supabase test db");

    const ciYml = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
    expect(ciYml).toContain("db-tests:");
    expect(ciYml).toContain("supabase/setup-cli@v1");
    expect(ciYml).toContain(
      "supabase start -x studio,imgproxy,vector,logflare,supavisor,edge-runtime,storage-api,realtime",
    );
    expect(ciYml).toContain("npm run db:test");

    // CI summary job enforces db-tests
    expect(ciYml).toMatch(/needs:\s*\[.*db-tests.*\]/);
    expect(ciYml).toContain("needs.db-tests.result");
  });
});
