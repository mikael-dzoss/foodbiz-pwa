import { describe, expect, it } from "vitest";
import { hoursExceptionsSchema, weeklyHoursSchema } from "@/domain/opening-hours";

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
  DEMO_STAGING_HOURS_EXCEPTIONS,
  DEMO_STAGING_WEEKLY_HOURS,
  sqlJsonb,
  sqlNullableJsonb,
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

  it("includes the replace-semantics header comment and atomic do $seed$ block", () => {
    const sql = buildSeedSql();

    expect(sql).toContain("npm run db:seed:gen");
    expect(sql).toContain("src/lib/repositories/mock/fixtures");
    expect(sql.toLowerCase()).toContain("do not edit by hand");
    expect(sql).toContain("Re-runnable:");
    expect(sql).toContain("business_members (provisioned by scripts/provision-member.mjs)");
    expect(sql).toContain("Never run against production.");
    expect(sql).toContain("supabase db reset");
    expect(sql).toContain("db-seed-staging.yml");

    expect(sql.match(/\bdo \$seed\$/g)).toHaveLength(1);
    expect(sql.match(/\bend\s+\$seed\$;/g)).toHaveLength(1);
    expect(sql).toContain("declare\n  v_days integer;");
    expect(sql).toMatch(
      /v_days := greatest\(0, \(now\(\) at time zone 'Europe\/Paris'\)::date - date '\d{4}-\d{2}-\d{2}'\);/,
    );
  });

  it("deletes demo business child rows in FK-safe order before any inserts and never touches businesses, business_members, auth.*, or rate_limit_attempts", () => {
    const sql = buildSeedSql();
    const firstInsertPos = sql.indexOf("insert into public.");
    expect(firstInsertPos).toBeGreaterThan(-1);

    const deleteTables = [
      "order_items",
      "orders",
      "guests",
      "expenses",
      "products",
      "product_categories",
    ] as const;

    let prevPos = -1;
    for (const table of deleteTables) {
      const stmt = `delete from public.${table} where business_id = '${demoBusiness.id}'::uuid;`;
      const pos = sql.indexOf(stmt);
      expect(pos, `missing scoped delete for public.${table}`).toBeGreaterThan(prevPos);
      expect(pos, `delete for public.${table} must appear before inserts`).toBeLessThan(
        firstInsertPos,
      );
      prevPos = pos;
    }

    // Must never delete businesses (cascades to business_members) or touch auth/membership/rate_limit tables
    expect(sql).not.toMatch(/delete\s+from\s+(?:public\.)?businesses\b/i);
    expect(sql).not.toMatch(/delete\s+from\s+(?:public\.)?business_members\b/i);
    expect(sql).not.toMatch(/delete\s+from\s+(?:public\.)?business_settings\b/i);
    expect(sql).not.toMatch(/\bauth\./i);
    expect(sql).not.toMatch(/\brate_limit_attempts\b/i);
  });

  it("derives the delete scope from fixtures.business.id instead of hard-coding it", () => {
    const customBusinessId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const sql = buildSeedSql({
      business: { ...demoBusiness, id: customBusinessId },
      settings: { ...demoSettings, businessId: customBusinessId },
      categories: [],
      products: [],
      guests: [],
      orders: [],
      expenses: [],
    });

    for (const table of [
      "order_items",
      "orders",
      "guests",
      "expenses",
      "products",
      "product_categories",
    ] as const) {
      expect(sql).toContain(
        `delete from public.${table} where business_id = '${customBusinessId}'::uuid;`,
      );
    }
    expect(sql).not.toContain(demoBusiness.id);
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

  it("seeds two RER relay pickup locations after expenses and replaces them on re-run", () => {
    const sql = buildSeedSql();
    const stmt = extractTableInsert(sql, "pickup_locations");
    expect(stmt).toContain("Gare RER B – La Plaine Stade de France");
    expect(stmt).toContain("'93210'");
    expect(stmt).toContain("Gare RER D – Saint-Denis");
    expect(stmt).toContain("'93200'");
    expect(stmt).toMatch(/, 150, /);
    expect(stmt).not.toMatch(/\bcreated_at\b|\bupdated_at\b/);
    expect(sql.indexOf("insert into public.pickup_locations (")).toBeGreaterThan(
      sql.indexOf("insert into public.expenses ("),
    );
    expect(sql).toContain(
      `delete from public.pickup_locations where business_id = '${demoBusiness.id}'::uuid;`,
    );
    expect(extractTableInsert(sql, "business_settings")).toContain("shop_pickup_enabled");
  });

  it("never emits tracking_token and sets updated_at only on orders", () => {
    const sql = buildSeedSql();
    expect(sql).not.toMatch(/\btracking_token\b/);
    expect(extractTableInsert(sql, "orders")).toMatch(/\bupdated_at\b/);
    for (const table of ["businesses", "business_settings", "products", "expenses"]) {
      expect(extractTableInsert(sql, table)).not.toMatch(/\bupdated_at\b/);
    }
  });

  it("upserts all non-id columns for businesses on conflict (id)", () => {
    const stmt = extractTableInsert(buildSeedSql(), "businesses");
    const colMatch = stmt.match(/insert into public\.businesses \(([\s\S]*?)\)\s*values/);
    expect(colMatch).not.toBeNull();
    const columns = colMatch![1]
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const nonIdColumns = columns.filter((c) => c !== "id");

    expect(stmt).toContain("on conflict (id) do update set");
    expect(stmt).not.toContain("id = excluded.id");
    for (const col of nonIdColumns) {
      expect(stmt, `businesses must update ${col} on conflict`).toContain(
        `${col} = excluded.${col}`,
      );
    }
  });

  it("includes timezone, weekly_hours, and hours_exceptions in business_settings and upserts all non-id, non-business_id columns on conflict (business_id)", () => {
    const stmt = extractTableInsert(buildSeedSql(), "business_settings");
    expect(stmt).toMatch(/\btimezone\b/);
    expect(stmt).toContain(sqlText(demoSettings.timezone));
    expect(stmt).toMatch(/\bweekly_hours\b/);
    expect(stmt).toContain("weekly_hours = excluded.weekly_hours");
    expect(stmt).toMatch(/\bhours_exceptions\b/);
    expect(stmt).toContain("hours_exceptions = excluded.hours_exceptions");

    const colMatch = stmt.match(/insert into public\.business_settings \(([\s\S]*?)\)\s*values/);
    expect(colMatch).not.toBeNull();
    const columns = colMatch![1]
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const updatableColumns = columns.filter((c) => c !== "id" && c !== "business_id");

    expect(stmt).toContain("on conflict (business_id) do update set");
    expect(stmt).not.toContain("id = excluded.id");
    expect(stmt).not.toContain("business_id = excluded.business_id");
    for (const col of updatableColumns) {
      expect(stmt, `business_settings must update ${col} on conflict`).toContain(
        `${col} = excluded.${col}`,
      );
    }
  });

  it("seeds realistic weekly_hours and relative-dated upcoming hours_exceptions for Les Saveurs du Continent while keeping mock fixtures null / []", () => {
    // Mock fixtures stay unconstrained so mock-mode tests/e2e never depend on time of day
    expect(demoSettings.weeklyHours).toBeNull();
    expect(demoSettings.hoursExceptions).toEqual([]);

    expect(weeklyHoursSchema.parse(DEMO_STAGING_WEEKLY_HOURS)).toEqual({
      mon: [],
      tue: [
        { open: "11:30", close: "14:30" },
        { open: "18:00", close: "22:00" },
      ],
      wed: [
        { open: "11:30", close: "14:30" },
        { open: "18:00", close: "22:00" },
      ],
      thu: [
        { open: "11:30", close: "14:30" },
        { open: "18:00", close: "22:00" },
      ],
      fri: [
        { open: "11:30", close: "14:30" },
        { open: "18:00", close: "24:00" },
      ],
      sat: [
        { open: "00:00", close: "01:00" },
        { open: "11:30", close: "15:00" },
        { open: "18:00", close: "24:00" },
      ],
      sun: [
        { open: "00:00", close: "01:00" },
        { open: "12:00", close: "16:00" },
      ],
    });

    const parsedExceptions = hoursExceptionsSchema.parse(DEMO_STAGING_HOURS_EXCEPTIONS);
    expect(parsedExceptions).toHaveLength(2);
    expect(parsedExceptions.some((e) => e.ranges.length === 0 && e.note === "Congés annuels")).toBe(
      true,
    );
    expect(parsedExceptions.some((e) => e.ranges.length > 0 && Boolean(e.note))).toBe(true);

    const stmt = extractTableInsert(buildSeedSql(), "business_settings");
    expect(stmt).toContain(sqlJsonb(DEMO_STAGING_WEEKLY_HOURS));
    expect(stmt).toContain("Congés annuels");
    expect(stmt).toContain("to_char(date '");
    expect(stmt).toContain("+ v_days, 'YYYY-MM-DD')");
  });

  it("uses plain inserts without on conflict or where exists for replaced child tables", () => {
    const sql = buildSeedSql();

    for (const table of [
      "product_categories",
      "products",
      "guests",
      "orders",
      "order_items",
      "expenses",
    ] as const) {
      const stmt = extractTableInsert(sql, table);
      expect(stmt, `${table} should not have on conflict`).not.toMatch(/\bon conflict\b/i);
      expect(stmt, `${table} should not have where exists`).not.toMatch(/\bwhere exists\b/i);
    }
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
    expect(sqlNullableJsonb(null)).toBe("null");
    expect(sqlNullableJsonb(undefined)).toBe("null");
    expect(sqlNullableJsonb({ ok: true })).toBe(`'{"ok":true}'::jsonb`);
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
        hoursExceptions: [{ from: "2026-11-01", to: "2026-11-01", ranges: [] }],
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
    expect(sql).toContain("https://tiktok.com/@latelier");
    // business_settings without id omits the id column so DB default applies
    const settingsStmt = extractTableInsert(sql, "business_settings");
    expect(settingsStmt).not.toMatch(/insert into public\.business_settings \(\s*id,/);
    expect(settingsStmt).not.toContain("'note'");
  });

  it("rejects orders without status history and text containing the $seed$ tag", () => {
    const base: SeedFixtures = {
      business: demoBusiness,
      settings: demoSettings,
      categories: demoCategories,
      products: demoProducts,
      guests: demoGuests,
      orders: demoOrders,
      expenses: demoExpenses,
    };
    expect(() =>
      buildSeedSql({ ...base, orders: [{ ...demoOrders[0], statusHistory: [] }] }),
    ).toThrow(/statusHistory/);
    expect(() =>
      buildSeedSql({ ...base, business: { ...base.business, name: "x $seed$ y" } }),
    ).toThrow(/\$seed\$/);
  });

  it("anchors the date shift on today in the shop time zone", () => {
    expect(buildSeedSql()).toContain("(now() at time zone 'Europe/Paris')::date");
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
    expect(extractTableInsert(sql, "business_settings")).toContain("'[]'::jsonb");
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
