import { describe, expect, it } from "vitest";

import {
  demoBusiness,
  demoCategories,
  demoExpenses,
  demoGuests,
  demoOrders,
  demoProducts,
  demoSettings,
} from "../mock/fixtures";
import {
  buildSeedSql,
  sqlJsonb,
  sqlNullableText,
  sqlNumber,
  sqlText,
  sqlTextArray,
  type SeedFixtures,
} from "../seed/build-seed-sql";

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/** Extracts the SQL section from `insert into public.<table>` up to its terminating semicolon. */
function extractTableInsert(sql: string, table: string): string {
  const marker = `insert into public.${table} (`;
  const start = sql.indexOf(marker);
  expect(start, `expected insert statement for public.${table}`).toBeGreaterThan(-1);
  const end = sql.indexOf(";", start);
  expect(end, `expected terminating semicolon for public.${table}`).toBeGreaterThan(start);
  return sql.slice(start, end + 1);
}

describe("buildSeedSql", () => {
  it("matches the committed supabase/seed.sql snapshot", async () => {
    await expect(buildSeedSql()).toMatchFileSnapshot("../../../../supabase/seed.sql");
  });

  it("produces deterministic output across repeated calls", () => {
    expect(buildSeedSql()).toBe(buildSeedSql());
  });

  it("ensures every fixture guest phone already matches the DB E.164 constraint", () => {
    for (const guest of demoGuests) {
      if (guest.phone != null) {
        expect(guest.phone).toMatch(E164_REGEX);
      }
    }
  });

  it("includes the generated-file header comment and atomic do $seed$ block", () => {
    const sql = buildSeedSql();

    expect(sql).toContain("npm run db:seed:gen");
    expect(sql).toContain("src/lib/repositories/mock/fixtures");
    expect(sql.toLowerCase()).toContain("do not edit by hand");
    expect(sql).toContain("supabase db reset");
    expect(sql).toContain("db-seed-staging.yml");
    expect(sql).toContain("scripts/provision-member.mjs");

    expect(sql.match(/\bdo \$seed\$/g)).toHaveLength(1);
    expect(sql.match(/\bend\s+\$seed\$;/g)).toHaveLength(1);
    expect(sql).toContain("declare\n  v_days integer;");
    expect(sql).toMatch(/v_days := greatest\(0, current_date - date '\d{4}-\d{2}-\d{2}'\);/);
  });

  it("inserts tables in strict FK order", () => {
    const sql = buildSeedSql();
    const tables = [
      "businesses",
      "business_settings",
      "product_categories",
      "products",
      "guests",
      "orders",
      "order_items",
      "expenses",
    ];
    const positions = tables.map((table) => sql.indexOf(`insert into public.${table} (`));
    for (let i = 0; i < positions.length; i += 1) {
      expect(positions[i], `missing insert for ${tables[i]}`).toBeGreaterThan(-1);
      if (i > 0) {
        expect(positions[i], `${tables[i]} must appear after ${tables[i - 1]}`).toBeGreaterThan(
          positions[i - 1],
        );
      }
    }
  });

  it("never emits tracking_token or updated_at columns", () => {
    const sql = buildSeedSql();
    expect(sql).not.toMatch(/\btracking_token\b/);
    expect(sql).not.toMatch(/\bupdated_at\b/);
  });

  it("includes timezone in business_settings and uses on conflict (business_id) do nothing", () => {
    const stmt = extractTableInsert(buildSeedSql(), "business_settings");
    expect(stmt).toMatch(/\btimezone\b/);
    expect(stmt).toContain(sqlText(demoSettings.timezone));
    expect(stmt).toMatch(/on conflict \(business_id\) do nothing;$/);
  });

  it("upserts all non-id columns for businesses, product_categories, and products", () => {
    const sql = buildSeedSql();

    for (const table of ["businesses", "product_categories", "products"] as const) {
      const stmt = extractTableInsert(sql, table);
      const colMatch = stmt.match(/insert into public\.\w+ \(([\s\S]*?)\)\s*values/);
      expect(colMatch, `column list missing for ${table}`).not.toBeNull();
      const columns = colMatch![1]
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const nonIdColumns = columns.filter((c) => c !== "id");

      expect(stmt).toContain("on conflict (id) do update set");
      for (const col of nonIdColumns) {
        expect(stmt, `${table} must update ${col} on conflict`).toContain(
          `${col} = excluded.${col}`,
        );
      }
    }
  });

  it("uses targetless on conflict do nothing for guests, orders, and expenses", () => {
    const sql = buildSeedSql();

    for (const table of ["guests", "orders", "expenses"] as const) {
      const stmt = extractTableInsert(sql, table);
      expect(stmt).toMatch(/on conflict do nothing;$/);
    }
  });

  it("guards order_items with where exists against public.orders and on conflict (id) do nothing", () => {
    const stmt = extractTableInsert(buildSeedSql(), "order_items");
    expect(stmt).toContain("select");
    expect(stmt).toContain("where exists (select 1 from public.orders where id =");
    expect(stmt).toMatch(/on conflict \(id\) do nothing;$/);
  });

  it("shifts temporal values by v_days and formats status_history timestamps back to UTC ISO", () => {
    const sql = buildSeedSql();
    const guestsStmt = extractTableInsert(sql, "guests");
    const ordersStmt = extractTableInsert(sql, "orders");
    const itemsStmt = extractTableInsert(sql, "order_items");
    const expensesStmt = extractTableInsert(sql, "expenses");

    expect(guestsStmt).toContain("+ make_interval(days => v_days)");
    expect(ordersStmt).toContain("+ make_interval(days => v_days)");
    expect(ordersStmt).toContain("+ v_days");
    expect(ordersStmt).toContain("jsonb_build_array(");
    expect(ordersStmt).toContain("jsonb_build_object(");
    expect(ordersStmt).toContain(`at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`);
    expect(itemsStmt).toContain("+ make_interval(days => v_days)");
    expect(expensesStmt).toContain("+ v_days");
    expect(expensesStmt).toContain("+ make_interval(days => v_days)");
  });
});

describe("SQL literal escaping helpers", () => {
  it("doubles single quotes in text literals", () => {
    expect(sqlText("L'Éclair d'Or")).toBe("'L''Éclair d''Or'");
    expect(sqlText("")).toBe("''");
  });

  it("renders null and undefined as SQL null", () => {
    expect(sqlNullableText(null)).toBe("null");
    expect(sqlNullableText(undefined)).toBe("null");
    expect(sqlNullableText("O'Brien")).toBe("'O''Brien'");
  });

  it("renders empty and non-empty text[] arrays with escaped items", () => {
    expect(sqlTextArray([])).toBe("array[]::text[]");
    expect(sqlTextArray(["gluten", "chef's choice"])).toBe(
      "array['gluten', 'chef''s choice']::text[]",
    );
  });

  it("renders jsonb literals with doubled single quotes", () => {
    expect(sqlJsonb({ note: "L'atelier", ok: true })).toBe(
      `'{"note":"L''atelier","ok":true}'::jsonb`,
    );
  });

  it("formats finite numbers and rejects non-finite numbers", () => {
    expect(sqlNumber(0)).toBe("0");
    expect(sqlNumber(5.5)).toBe("5.5");
    expect(() => sqlNumber(Number.NaN)).toThrow();
    expect(() => sqlNumber(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("buildSeedSql edge cases", () => {
  it("escapes single quotes across fixtures, strips spaces from guest phones, and handles nulls", () => {
    const fixtures: SeedFixtures = {
      business: {
        ...demoBusiness,
        name: "L'Atelier d'Or",
        description: "Chef's special",
        phone: undefined,
        email: undefined,
        whatsappNumber: undefined,
        instagramUrl: undefined,
        facebookUrl: undefined,
        tiktokUrl: "https://tiktok.com/@latelier",
        address: undefined,
        latitude: null,
        longitude: null,
        logoUrl: null,
      },
      settings: {
        ...demoSettings,
        id: undefined,
        openingHours: "Mon's: 08:00-18:00",
        paymentInstructionsEn: "Pay at L'Atelier",
        paymentInstructionsFr: "Payer à l'atelier",
      },
      categories: [
        {
          ...demoCategories[0],
          name: "Chef's Breads",
        },
      ],
      products: [
        {
          ...demoProducts[0],
          name: "L'Originale",
          description: null,
          allergens: [],
          imageUrl: null,
        },
      ],
      guests: [
        {
          ...demoGuests[0],
          name: "O'Connor",
          phone: "+33 6 12 34 56 71",
          email: null,
          address: null,
          notes: "Doesn't eat nuts",
        },
        {
          ...demoGuests[1],
          phone: null,
          email: null,
          address: null,
          notes: null,
        },
      ],
      orders: [
        {
          ...demoOrders[0],
          submittedName: "D'Artagnan",
          paid: "unpaid",
          paymentMethod: null,
          paidAt: null,
          refundedAt: null,
          requestedTime: null,
          cancellationReason: null,
          notes: "Leave at chef's door",
          deliveryAddress: null,
          statusHistory: [
            {
              status: "NEW",
              timestamp: "2026-10-01T10:00:00.000Z",
              note: "Customer's request",
            },
            {
              status: "CONFIRMED",
              timestamp: "2026-10-01T10:05:00.000Z",
              note: null,
            },
          ],
          items: [
            {
              ...demoOrders[0].items[0],
              productName: "L'Originale",
            },
          ],
        },
        {
          ...demoOrders[1],
          statusHistory: [],
        },
      ],
      expenses: [
        {
          ...demoExpenses[0],
          description: "Baker's yeast",
          tags: ["Ingredients", "Chef's Supplies"],
        },
      ],
    };

    const sql = buildSeedSql(fixtures);

    expect(sql).toContain("'L''Atelier d''Or'");
    expect(sql).toContain("'Chef''s Breads'");
    expect(sql).toContain("'L''Originale'");
    expect(sql).toContain("'O''Connor'");
    expect(sql).toContain("'+33612345671'");
    expect(sql).toContain("'D''Artagnan'");
    expect(sql).toContain("'Customer''s request'");
    expect(sql).toContain("'Baker''s yeast'");
    expect(sql).toContain("array['Ingredients', 'Chef''s Supplies']::text[]");
    expect(sql).toContain("'[]'::jsonb");
    expect(sql).toContain("https://tiktok.com/@latelier");
    // business_settings without id omits the id column so DB default applies
    const settingsStmt = extractTableInsert(sql, "business_settings");
    expect(settingsStmt).not.toMatch(/insert into public\.business_settings \(\s*id,/);
  });

  it("handles empty collections gracefully", () => {
    const emptyFixtures: SeedFixtures = {
      business: demoBusiness,
      settings: demoSettings,
      categories: [],
      products: [],
      guests: [],
      orders: [],
      expenses: [],
    };
    const sql = buildSeedSql(emptyFixtures);
    expect(sql).toContain("v_days := 0;");
    expect(sql).toContain("insert into public.businesses (");
    expect(sql).toContain("insert into public.business_settings (");
    expect(sql).not.toContain("insert into public.product_categories (");
    expect(sql).not.toContain("insert into public.products (");
    expect(sql).not.toContain("insert into public.guests (");
    expect(sql).not.toContain("insert into public.orders (");
    expect(sql).not.toContain("insert into public.order_items (");
    expect(sql).not.toContain("insert into public.expenses (");
  });

  it("throws when an order is missing orderNumber or an order item is missing id", () => {
    expect(() =>
      buildSeedSql({
        business: demoBusiness,
        settings: demoSettings,
        categories: demoCategories,
        products: demoProducts,
        guests: demoGuests,
        orders: [{ ...demoOrders[0], orderNumber: undefined }],
        expenses: [],
      }),
    ).toThrow(/orderNumber/);

    expect(() =>
      buildSeedSql({
        business: demoBusiness,
        settings: demoSettings,
        categories: demoCategories,
        products: demoProducts,
        guests: demoGuests,
        orders: [
          {
            ...demoOrders[0],
            items: [{ ...demoOrders[0].items[0], id: undefined }],
          },
        ],
        expenses: [],
      }),
    ).toThrow(/order item/i);
  });
});
