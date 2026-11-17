import { describe, expect, it } from "vitest";
import {
  STANDARD_EXPENSE_TAGS,
  createExpenseInputSchema,
  updateExpenseInputSchema,
  groupExpensesByMonth,
  filterExpenses,
  calculateExpensesTotal,
  type Expense,
} from "../expense";

const mockExpenses: Expense[] = [
  {
    id: "55555555-5555-4555-8555-555555555501",
    businessId: "11111111-1111-4111-8111-111111111111",
    amount: 12450, // €124.50
    date: "2026-10-14",
    description: "Organic vegetables",
    tags: ["Ingredients"],
    createdAt: "2026-10-14T09:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555502",
    businessId: "11111111-1111-4111-8111-111111111111",
    amount: 7800, // €78.00
    date: "2026-10-10",
    description: "Van fuel refill",
    tags: ["Transport"],
    createdAt: "2026-10-10T14:30:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555503",
    businessId: "11111111-1111-4111-8111-111111111111",
    amount: 21500, // €215.00
    date: "2026-09-25",
    description: "Takeaway containers",
    tags: ["Supplies"],
    createdAt: "2026-09-25T11:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555504",
    businessId: "11111111-1111-4111-8111-111111111111",
    amount: 8000, // €80.00
    date: "2026-09-02",
    description: "Internet & phone",
    tags: ["Utilities"],
    createdAt: "2026-09-02T08:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555505",
    businessId: "11111111-1111-4111-8111-111111111111",
    amount: 50000, // €500.00
    date: "2026-08-15",
    description: "Induction stove repair",
    tags: ["Equipment"],
    createdAt: "2026-08-15T16:00:00.000Z",
  },
];

describe("domain: expense standard tags", () => {
  it("defines the 5 required standard tags from issue #59", () => {
    expect(STANDARD_EXPENSE_TAGS).toEqual([
      "Ingredients",
      "Transport",
      "Equipment",
      "Supplies",
      "Utilities",
    ]);
  });
});

describe("domain: createExpenseInputSchema", () => {
  it("validates a complete valid payload", () => {
    const input = {
      amount: 14550,
      date: "2026-10-15",
      description: "Metro wholesale flour",
      tags: ["Ingredients"],
    };
    const parsed = createExpenseInputSchema.parse(input);
    expect(parsed.amount).toBe(14550);
    expect(parsed.date).toBe("2026-10-15");
    expect(parsed.description).toBe("Metro wholesale flour");
    expect(parsed.tags).toEqual(["Ingredients"]);
  });

  it("trims description and tags", () => {
    const input = {
      amount: 5000,
      date: "2026-10-15",
      description: "   Coffee beans   ",
      tags: ["  Ingredients  "],
    };
    const parsed = createExpenseInputSchema.parse(input);
    expect(parsed.description).toBe("Coffee beans");
    expect(parsed.tags).toEqual(["Ingredients"]);
  });

  it("rejects non-positive amount (zero or negative)", () => {
    expect(() =>
      createExpenseInputSchema.parse({
        amount: 0,
        date: "2026-10-15",
        description: "Zero cost",
        tags: ["Ingredients"],
      }),
    ).toThrow();

    expect(() =>
      createExpenseInputSchema.parse({
        amount: -500,
        date: "2026-10-15",
        description: "Negative cost",
        tags: ["Ingredients"],
      }),
    ).toThrow();
  });

  it("rejects non-integer amount", () => {
    expect(() =>
      createExpenseInputSchema.parse({
        amount: 12.5,
        date: "2026-10-15",
        description: "Float amount",
        tags: ["Ingredients"],
      }),
    ).toThrow();
  });

  it("rejects empty description or whitespace only", () => {
    expect(() =>
      createExpenseInputSchema.parse({
        amount: 1000,
        date: "2026-10-15",
        description: "    ",
        tags: ["Ingredients"],
      }),
    ).toThrow();
  });

  it("rejects invalid date format", () => {
    expect(() =>
      createExpenseInputSchema.parse({
        amount: 1000,
        date: "15-10-2026",
        description: "Wrong date",
        tags: ["Ingredients"],
      }),
    ).toThrow();
  });

  it("rejects empty tags array", () => {
    expect(() =>
      createExpenseInputSchema.parse({
        amount: 1000,
        date: "2026-10-15",
        description: "No tags",
        tags: [],
      }),
    ).toThrow();
  });
});

describe("domain: updateExpenseInputSchema", () => {
  it("allows partial updates", () => {
    const input = { amount: 8900 };
    const parsed = updateExpenseInputSchema.parse(input);
    expect(parsed.amount).toBe(8900);
    expect(parsed.description).toBeUndefined();
  });

  it("rejects zero or negative amount if provided", () => {
    expect(() => updateExpenseInputSchema.parse({ amount: 0 })).toThrow();
  });

  it("rejects empty description if provided", () => {
    expect(() => updateExpenseInputSchema.parse({ description: "   " })).toThrow();
  });
});

describe("domain: groupExpensesByMonth", () => {
  it("groups expenses by calendar month and calculates totals and counts", () => {
    const groups = groupExpensesByMonth(mockExpenses);

    expect(groups).toHaveLength(3);

    // October 2026: 2 items, total €124.50 + €78.00 = €202.50 (20250)
    expect(groups[0].monthKey).toBe("2026-10");
    expect(groups[0].year).toBe(2026);
    expect(groups[0].month).toBe(10);
    expect(groups[0].count).toBe(2);
    expect(groups[0].totalAmount).toBe(20250);
    expect(groups[0].expenses).toHaveLength(2);

    // September 2026: 2 items, total €215.00 + €80.00 = €295.00 (29500)
    expect(groups[1].monthKey).toBe("2026-09");
    expect(groups[1].year).toBe(2026);
    expect(groups[1].month).toBe(9);
    expect(groups[1].count).toBe(2);
    expect(groups[1].totalAmount).toBe(29500);
    expect(groups[1].expenses).toHaveLength(2);

    // August 2026: 1 item, total €500.00 (50000)
    expect(groups[2].monthKey).toBe("2026-08");
    expect(groups[2].count).toBe(1);
    expect(groups[2].totalAmount).toBe(50000);
  });

  it("returns empty array for empty expenses list", () => {
    expect(groupExpensesByMonth([])).toEqual([]);
  });

  it("sorts expenses within a month descending by date", () => {
    const groups = groupExpensesByMonth(mockExpenses);
    const oct = groups[0].expenses;
    expect(oct[0].date).toBe("2026-10-14");
    expect(oct[1].date).toBe("2026-10-10");
  });
});

describe("domain: filterExpenses", () => {
  const refDate = new Date("2026-10-15T12:00:00Z");

  it("filters by period 'this-month'", () => {
    const filtered = filterExpenses(mockExpenses, {
      period: "this-month",
      referenceDate: refDate,
      timeZone: "UTC",
    });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.date.startsWith("2026-10"))).toBe(true);
  });

  it("filters by period 'last-month'", () => {
    const filtered = filterExpenses(mockExpenses, {
      period: "last-month",
      referenceDate: refDate,
      timeZone: "UTC",
    });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.date.startsWith("2026-09"))).toBe(true);
  });

  it("handles last-month year rollover in January", () => {
    const janRef = new Date("2027-01-10T12:00:00Z");
    const testList: Expense[] = [
      {
        id: "1",
        businessId: "b",
        amount: 1000,
        date: "2026-12-28",
        description: "December bill",
        tags: ["Utilities"],
        createdAt: "2026-12-28T00:00:00Z",
      },
      {
        id: "2",
        businessId: "b",
        amount: 2000,
        date: "2027-01-05",
        description: "January flour",
        tags: ["Ingredients"],
        createdAt: "2027-01-05T00:00:00Z",
      },
    ];

    const decFiltered = filterExpenses(testList, {
      period: "last-month",
      referenceDate: janRef,
      timeZone: "UTC",
    });
    expect(decFiltered).toHaveLength(1);
    expect(decFiltered[0].description).toBe("December bill");
  });

  it("filters by tag", () => {
    const ingredients = filterExpenses(mockExpenses, { tag: "Ingredients", timeZone: "UTC" });
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0].description).toBe("Organic vegetables");
  });

  it("returns all when tag is 'all' or empty", () => {
    const all = filterExpenses(mockExpenses, { tag: "all", timeZone: "UTC" });
    expect(all).toHaveLength(5);
  });

  it("combines period and tag filtering", () => {
    const combined = filterExpenses(mockExpenses, {
      period: "this-month",
      tag: "Transport",
      referenceDate: refDate,
      timeZone: "UTC",
    });
    expect(combined).toHaveLength(1);
    expect(combined[0].description).toBe("Van fuel refill");
  });
});

describe("domain: calculateExpensesTotal", () => {
  it("calculates sum of amounts in cents", () => {
    expect(calculateExpensesTotal(mockExpenses)).toBe(12450 + 7800 + 21500 + 8000 + 50000);
  });

  it("returns 0 for empty array", () => {
    expect(calculateExpensesTotal([])).toBe(0);
  });

  it("takes the current month from the business calendar, not UTC (#168)", () => {
    // 23:30 UTC on 30 Sep is already 1 Oct in Paris
    const instant = new Date("2026-09-30T23:30:00Z");
    const paris = filterExpenses(mockExpenses, {
      period: "this-month",
      referenceDate: instant,
      timeZone: "Europe/Paris",
    });
    const utc = filterExpenses(mockExpenses, {
      period: "this-month",
      referenceDate: instant,
      timeZone: "UTC",
    });
    expect(paris.every((e) => e.date.startsWith("2026-10"))).toBe(true);
    expect(utc.every((e) => e.date.startsWith("2026-09"))).toBe(true);
  });

  it("requires a reference date with a period filter", () => {
    expect(() => filterExpenses(mockExpenses, { period: "this-month", timeZone: "UTC" })).toThrow(
      "referenceDate",
    );
  });
});
