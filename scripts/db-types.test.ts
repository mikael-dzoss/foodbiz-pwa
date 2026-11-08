// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkDatabaseTypes,
  generateTypesFromMigrations,
  generateTypesFromSql,
  parseSqlSchema,
} from "./db-types.mjs";

const root = resolve(import.meta.dirname, "..");

describe("database types generator and drift check (#119)", () => {
  it("parses all 9 tables and 9 enums from the initial schema migration", () => {
    const sql = readFileSync(
      resolve(root, "supabase/migrations/20260101000000_initial_schema.sql"),
      "utf8",
    );
    const schema = parseSqlSchema(sql);

    expect(Object.keys(schema.enums)).toEqual([
      "category_role",
      "business_member_role",
      "date_format",
      "order_status",
      "order_paid_status",
      "order_service_type",
      "order_channel",
      "order_payment_preference",
      "order_payment_method",
    ]);
    expect(schema.enums.order_paid_status).toEqual(["paid", "unpaid", "refunded"]);

    expect(Object.keys(schema.tables)).toEqual([
      "businesses",
      "business_members",
      "business_settings",
      "product_categories",
      "products",
      "guests",
      "orders",
      "order_items",
      "expenses",
    ]);

    const businessSettingsRel = schema.tables.business_settings.relationships.find(
      (r: { columns: string[] }) => r.columns[0] === "business_id",
    );
    expect(businessSettingsRel).toMatchObject({
      foreignKeyName: "business_settings_business_id_fkey",
      columns: ["business_id"],
      isOneToOne: true,
      referencedRelation: "businesses",
      referencedColumns: ["id"],
    });
  });

  it("keeps committed src/lib/supabase/database.types.ts in sync with supabase/migrations", () => {
    const result = checkDatabaseTypes({
      migrationsDir: resolve(root, "supabase/migrations"),
      typesPath: resolve(root, "src/lib/supabase/database.types.ts"),
    });
    expect(result.inSync).toBe(true);

    const committed = readFileSync(resolve(root, "src/lib/supabase/database.types.ts"), "utf8");
    expect(committed).toContain("refunded_at: string | null;");
    expect(committed).toContain("delivery_address: string | null;");
    expect(committed).toContain("status_history: Json;");
    expect(committed).toContain('order_paid_status: "paid" | "unpaid" | "refunded";');
  });

  it("detects schema drift when a migration adds or changes a column or enum", () => {
    const expected = generateTypesFromMigrations(resolve(root, "supabase/migrations"));
    const drifted = expected.replace("refunded_at: string | null;", "refunded_at: number | null;");

    const result = checkDatabaseTypes({
      migrationsDir: resolve(root, "supabase/migrations"),
      currentContent: drifted,
    });

    expect(result.inSync).toBe(false);
    expect(result.message).toMatch(/out of date|drift/i);
  });

  it("generates typed RPC functions when public SQL functions are declared", () => {
    const output = generateTypesFromSql(`
      create type status_enum as enum ('ok', 'err');
      create table items (
        id uuid primary key default gen_random_uuid(),
        label text not null,
        tags text[] not null default '{}',
        meta jsonb
      );
      create or replace function public.lookup_item(p_id uuid, p_limit int default 10)
      returns table (item_id uuid, total bigint)
      language sql stable as $$
        select id, 1::bigint from items where id = p_id limit p_limit;
      $$;
    `);

    expect(output).toContain("lookup_item: {");
    expect(output).toContain("p_id: string;");
    expect(output).toContain("p_limit?: number;");
    expect(output).toContain("item_id: string;");
    expect(output).toContain("total: number;");
  });
});
