// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("Product image storage and pgTAP test suite (#123)", () => {
  it("defines product-images bucket, helper function, and RLS policies in 20260101000003_product_images_storage.sql", () => {
    const migrationPath = resolve(
      root,
      "supabase/migrations/20260101000003_product_images_storage.sql",
    );
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    // 1. Bucket configuration
    expect(sql).toContain("product-images");
    expect(sql).toContain("5242880");
    expect(sql).toContain("image/jpeg");
    expect(sql).toContain("image/png");
    expect(sql).toContain("image/webp");
    expect(sql).toContain("image/avif");
    expect(sql).toContain("storage.buckets");

    // 2. Helper function
    expect(sql).toMatch(
      /create\s+(?:or\s+replace\s+)?function\s+public\.can_manage_product_image\s*\(/i,
    );
    expect(sql).toContain("split_part(object_name, '/', 1)");
    expect(sql).toContain("public.is_business_member");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");

    // 3. RLS policies on storage.objects
    expect(sql).toContain("product_images_select_public");
    expect(sql).toContain("product_images_insert_member");
    expect(sql).toContain("product_images_update_member");
    expect(sql).toContain("product_images_delete_member");
    expect(sql).toContain("public.can_manage_product_image(name)");

    // 4. Rollback notes present
    expect(sql).toMatch(/Rollback note/i);
  });

  it("provides comprehensive pgTAP test suite in supabase/tests/storage_policies.test.sql", () => {
    const testPath = resolve(root, "supabase/tests/storage_policies.test.sql");
    expect(existsSync(testPath)).toBe(true);

    const testSql = readFileSync(testPath, "utf8");

    // pgTAP structure
    expect(testSql).toMatch(/\bbegin;/i);
    expect(testSql).toMatch(/select\s+plan\(\d+\);/i);
    expect(testSql).toMatch(/select\s+\*\s+from\s+finish\(\);/i);
    expect(testSql).toMatch(/\brollback;/i);

    // Tests bucket properties
    expect(testSql).toContain("product-images");
    expect(testSql).toContain("5242880");

    // Tests role switching
    expect(testSql).toContain("set local role anon;");
    expect(testSql).toContain("set local role authenticated;");

    // Tests permissions and denials
    expect(testSql).toContain("42501");
    expect(testSql).toContain("anon can select objects in product-images");
    expect(testSql).toContain("member_a can insert image under Biz A folder");
    expect(testSql).toContain("member_a is denied insert into Biz B folder");
  });
});
