// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("Realtime order notifications and pgTAP test suite (#124)", () => {
  it("defines idempotent supabase_realtime publication and replica identity full in 20260101000004_realtime_orders.sql", () => {
    const migrationPath = resolve(root, "supabase/migrations/20260101000004_realtime_orders.sql");
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    // 1. Idempotent publication check and creation
    expect(sql).toContain("pg_publication");
    expect(sql).toContain("pubname = 'supabase_realtime'");
    expect(sql).toContain("create publication supabase_realtime;");

    // 2. Idempotent table addition
    expect(sql).toContain("pg_publication_tables");
    expect(sql).toContain("schemaname = 'public'");
    expect(sql).toContain("tablename = 'orders'");
    expect(sql).toContain("alter publication supabase_realtime add table public.orders;");

    // 3. Replica identity full configuration
    expect(sql).toMatch(/alter\s+table\s+public\.orders\s+replica\s+identity\s+full;/i);

    // 4. Rollback notes present
    expect(sql).toMatch(/Rollback note/i);
    expect(sql).toContain(
      "alter publication supabase_realtime drop table if exists public.orders;",
    );
    expect(sql).toContain("alter table public.orders replica identity default;");
  });

  it("provides comprehensive pgTAP test suite in supabase/tests/realtime_orders.test.sql", () => {
    const testPath = resolve(root, "supabase/tests/realtime_orders.test.sql");
    expect(existsSync(testPath)).toBe(true);

    const testSql = readFileSync(testPath, "utf8");

    // pgTAP structure
    expect(testSql).toMatch(/\bbegin;/i);
    expect(testSql).toMatch(/select\s+plan\(10\);/i);
    expect(testSql).toMatch(/select\s+\*\s+from\s+finish\(\);/i);
    expect(testSql).toMatch(/\brollback;/i);

    // Publication and replica identity assertions
    expect(testSql).toContain("supabase_realtime publication exists in pg_publication");
    expect(testSql).toContain(
      "public.orders is registered in pg_publication_tables under supabase_realtime",
    );
    expect(testSql).toContain("relreplident = 'f'");

    // RLS and policy assertions
    expect(testSql).toContain("relrowsecurity = true");
    expect(testSql).toContain("orders_select_authenticated");
    expect(testSql).toContain("anon role has no select policy on public.orders");

    // Role switching and tenant isolation
    expect(testSql).toContain("set local role anon;");
    expect(testSql).toContain("set local role authenticated;");
    expect(testSql).toContain("anon role cannot select any orders from public.orders");
    expect(testSql).toContain("authenticated member of Biz A can select Biz A orders");
    expect(testSql).toContain("authenticated member of Biz A cannot select Biz B orders");
    expect(testSql).toContain("authenticated non-member cannot select any orders");
  });
});
