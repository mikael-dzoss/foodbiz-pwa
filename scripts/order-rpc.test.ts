// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("Atomic order placement and cancellation functions (#121)", () => {
  it("defines find_or_create_guest, place_order, and cancel_order in 20260101000002_order_rpc_functions.sql", () => {
    const migrationPath = resolve(
      root,
      "supabase/migrations/20260101000002_order_rpc_functions.sql",
    );
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    // 1. Function declarations & signatures
    expect(sql).toMatch(
      /create\s+(?:or\s+replace\s+)?function\s+public\.find_or_create_guest\s*\(/i,
    );
    expect(sql).toMatch(/create\s+(?:or\s+replace\s+)?function\s+public\.place_order\s*\(/i);
    expect(sql).toMatch(/create\s+(?:or\s+replace\s+)?function\s+public\.cancel_order\s*\(/i);

    // 2. Security definer and search_path on all three functions
    const securityDefinerCount = (sql.match(/security\s+definer/gi) || []).length;
    expect(securityDefinerCount).toBeGreaterThanOrEqual(3);
    const searchPathCount = (sql.match(/set\s+search_path\s*=\s*public/gi) || []).length;
    expect(searchPathCount).toBeGreaterThanOrEqual(3);

    // 3. Advisory locks
    // guest advisory lock
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('guest:' || p_business_id::text || ':'");
    // order_number advisory lock
    expect(sql).toContain(
      "pg_advisory_xact_lock(hashtext('order_number:' || p_business_id::text))",
    );

    // 4. Guest name normalization and blind find-or-create
    expect(sql).toContain("regexp_replace(trim(p_name), '\\s+', ' ', 'g')");
    expect(sql).toContain(
      "p_update_guest_name is true and public.is_business_member(p_business_id)",
    );
    expect(sql).toContain("'nameMismatch'");

    // 5. Place order validations and locking
    expect(sql).toContain("for update of p");
    expect(sql).toContain("INSUFFICIENT_STOCK");
    expect(sql).toContain("P0001");
    expect(sql).toContain("PRODUCT_NOT_AVAILABLE");
    expect(sql).toContain("P0003");
    expect(sql).toContain("PRODUCT_NOT_FOUND");
    expect(sql).toContain("P0002");
    expect(sql).toContain("order_items");

    // 6. Cancel order stock restoration and status validation
    expect(sql).toContain("current_user in ('anon', 'authenticated')");
    expect(sql).toContain("public.is_business_member(p_business_id)");
    expect(sql).toContain("INVALID_STATUS_TRANSITION: cannot cancel a completed order");
    expect(sql).toContain("INVALID_STATUS_TRANSITION: order is already cancelled");
    expect(sql).toContain("p.stock + agg.qty");

    // 7. Role permissions
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.find_or_create_guest.*to\s+anon,\s*authenticated/i,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.place_order.*to\s+anon,\s*authenticated/i,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.cancel_order.*to\s+authenticated/i,
    );
    expect(sql).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.cancel_order.*to\s+anon/i);
  });

  it("exports TypeScript types for order RPC functions in database.types.ts", () => {
    const typesPath = resolve(root, "src/lib/supabase/database.types.ts");
    expect(existsSync(typesPath)).toBe(true);

    const ts = readFileSync(typesPath, "utf8");

    // Verify find_or_create_guest in Functions
    expect(ts).toContain("find_or_create_guest: {");
    expect(ts).toContain("p_business_id: string;");
    expect(ts).toContain("p_name: string;");
    expect(ts).toContain("p_phone: string;");
    expect(ts).toContain("p_update_guest_name?: boolean;");

    // Verify place_order in Functions
    expect(ts).toContain("place_order: {");
    expect(ts).toContain("p_guest_name: string;");
    expect(ts).toContain("p_guest_phone: string;");
    expect(ts).toContain('p_service_type: Database["public"]["Enums"]["order_service_type"];');
    expect(ts).toContain('p_channel: Database["public"]["Enums"]["order_channel"];');
    expect(ts).toContain("p_items: Json;");

    // Verify cancel_order in Functions
    expect(ts).toContain("cancel_order: {");
    expect(ts).toContain("p_order_id: string;");
    expect(ts).toContain("p_cancellation_reason?: string;");
  });

  it("provides comprehensive pgTAP test suite in supabase/tests/order_functions.test.sql", () => {
    const testPath = resolve(root, "supabase/tests/order_functions.test.sql");
    expect(existsSync(testPath)).toBe(true);

    const testSql = readFileSync(testPath, "utf8");

    // pgTAP structure
    expect(testSql).toMatch(/\bbegin;/i);
    expect(testSql).toMatch(/select\s+plan\(\d+\);/i);
    expect(testSql).toMatch(/select\s+\*\s+from\s+finish\(\);/i);
    expect(testSql).toMatch(/\brollback;/i);

    // AC 1: place_order stock validation, blind guest find-or-create, name mismatch handling
    expect(testSql).toContain("find_or_create_guest returns isNew=true for fresh guest");
    expect(testSql).toContain("find_or_create_guest normalizes and trims guest name");
    expect(testSql).toContain("find_or_create_guest flags nameMismatch=true when names differ");
    expect(testSql).toContain(
      "find_or_create_guest preserves canonical name when called without manager privileges",
    );
    expect(testSql).toContain(
      "find_or_create_guest returns nameMismatch=false when manager updates name",
    );
    expect(testSql).toContain("place_order decrements product stock from 10 to 8");
    expect(testSql).toContain(
      "place_order sets guest_id NOT NULL and submitted_name IS NULL for matching name",
    );
    expect(testSql).toContain("repeat place_order preserves original guest name");
    expect(testSql).toContain("repeat place_order records mismatched name in submitted_name");
    expect(testSql).toContain(
      "place_order by manager with p_update_guest_name=true updates guest name",
    );
    expect(testSql).toContain("place_order with updated guest name leaves submitted_name null");

    // AC 2: Cancel/reject restores stock atomically
    expect(testSql).toContain("cancel_order returns status CANCELLED");
    expect(testSql).toContain("cancel_order returns cancellation_reason");
    expect(testSql).toContain("orders table status is CANCELLED");
    expect(testSql).toContain("cancel_order atomically restores product stock");
    expect(testSql).toContain("cancel_order blocks anon with 42501");
    expect(testSql).toContain("cancel_order blocks authenticated non-member with 42501");
    expect(testSql).toContain("cancel_order blocks cancelling already cancelled order (22023)");
    expect(testSql).toContain("cancel_order blocks cancelling a completed order (22023)");

    // AC 3: Concurrency test: two orders for the last item -> one succeeds
    expect(testSql).toContain("first order for last item succeeds and decrements stock to 0");
    expect(testSql).toContain(
      "second order for out-of-stock item throws P0001 (INSUFFICIENT_STOCK)",
    );
    expect(testSql).toContain("stock remains 0 after failed order rollback");
  });
});
