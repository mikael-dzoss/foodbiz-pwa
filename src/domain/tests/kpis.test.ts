import { describe, expect, it } from "vitest";
import {
  calculateKpiDelta,
  calculateKpiMetrics,
  calculateKpiReport,
  dateRangeSchema,
  extractDate,
  getPreviousDateRange,
  kpiReportSchema,
  presentKpiDelta,
  resolveDateRange,
  type DateRange,
  type Expense,
  type Order,
} from "../index";

/** Legacy fixtures are written as UTC days, so the existing cases run in UTC. */
const TZ = "UTC";
const businessId = "11111111-1111-4111-8111-111111111111";

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: "22222222-2222-4111-8111-222222222222",
    businessId,
    guestId: "77777777-7777-4111-8111-777777777777",
    serviceType: "pickup",
    channel: "storefront",
    status: "COMPLETED",
    paid: "paid",
    paymentPreference: "on_handover",
    paymentMethod: "cash",
    paidAt: "2026-10-05T12:00:00.000Z",
    requestedDate: "2026-10-05",
    items: [
      {
        productId: "33333333-3333-4111-8111-333333333333",
        productName: "Burger",
        quantity: 1,
        unitPrice: 1500,
        totalPrice: 1500,
      },
    ],
    totalAmount: 1500,
    createdAt: "2026-10-05T10:00:00.000Z",
    updatedAt: "2026-10-05T12:30:00.000Z",
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: "44444444-4444-4111-8111-444444444444",
    businessId,
    amount: 500,
    date: "2026-10-05",
    description: "Ingredients",
    tags: ["supplies"],
    createdAt: "2026-10-05T09:00:00.000Z",
    ...overrides,
  };
}

describe("KPI Engine", () => {
  describe("extractDate", () => {
    it("extracts YYYY-MM-DD from various date representations", () => {
      expect(extractDate("2026-10-05", TZ)).toBe("2026-10-05");
      expect(extractDate("2026-10-05T14:32:00.000Z", TZ)).toBe("2026-10-05");
      const d = new Date(Date.UTC(2026, 9, 5, 22, 0, 0));
      expect(extractDate(d, TZ)).toBe("2026-10-05");
    });

    it("throws on invalid date input", () => {
      expect(() => extractDate("not-a-date", TZ)).toThrow();
      expect(() => extractDate(new Date(NaN), TZ)).toThrow();
      expect(() => extractDate("2026-02-30", TZ)).toThrow();
      expect(() => extractDate(123 as unknown as string, TZ)).toThrow();
    });
  });

  describe("resolveDateRange", () => {
    const referenceDate = "2026-10-15"; // Thursday

    it("resolves 'today'", () => {
      expect(resolveDateRange("today", referenceDate, TZ)).toEqual({
        startDate: "2026-10-15",
        endDate: "2026-10-15",
      });
    });

    it("resolves 'yesterday'", () => {
      expect(resolveDateRange("yesterday", referenceDate, TZ)).toEqual({
        startDate: "2026-10-14",
        endDate: "2026-10-14",
      });
    });

    it("resolves 'last_7_days' (7 days inclusive up to reference date)", () => {
      expect(resolveDateRange("last_7_days", referenceDate, TZ)).toEqual({
        startDate: "2026-10-09",
        endDate: "2026-10-15",
      });
    });

    it("resolves 'last_30_days' (30 days inclusive up to reference date)", () => {
      expect(resolveDateRange("last_30_days", referenceDate, TZ)).toEqual({
        startDate: "2026-09-16",
        endDate: "2026-10-15",
      });
    });

    it("resolves 'this_month'", () => {
      expect(resolveDateRange("this_month", referenceDate, TZ)).toEqual({
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      });
    });

    it("resolves 'last_month'", () => {
      expect(resolveDateRange("last_month", referenceDate, TZ)).toEqual({
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      });
    });
  });

  describe("getPreviousDateRange", () => {
    it("shifts a 7-day range backward by 7 days", () => {
      const period: DateRange = {
        startDate: "2026-10-09",
        endDate: "2026-10-15",
      };
      expect(getPreviousDateRange(period)).toEqual({
        startDate: "2026-10-02",
        endDate: "2026-10-08",
      });
    });

    it("shifts a 1-day range backward by 1 day", () => {
      const period: DateRange = {
        startDate: "2026-10-15",
        endDate: "2026-10-15",
      };
      expect(getPreviousDateRange(period)).toEqual({
        startDate: "2026-10-14",
        endDate: "2026-10-14",
      });
    });
  });

  describe("calculateKpiMetrics", () => {
    const period: DateRange = {
      startDate: "2026-10-01",
      endDate: "2026-10-07",
    };

    it("computes revenue from paid, non-cancelled orders by paidAt within window", () => {
      const orders = [
        makeOrder({
          id: "10000000-0000-4000-8000-000000000001",
          paid: "paid",
          paidAt: "2026-10-02T10:00:00.000Z",
          totalAmount: 2000,
          status: "COMPLETED",
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-000000000002",
          paid: "paid",
          paidAt: "2026-10-07T23:59:59.000Z",
          totalAmount: 1500,
          status: "READY",
        }),
        // Outside window (paid on Oct 8)
        makeOrder({
          id: "10000000-0000-4000-8000-000000000003",
          paid: "paid",
          paidAt: "2026-10-08T01:00:00.000Z",
          totalAmount: 3000,
          status: "COMPLETED",
        }),
        // Cancelled order (even if marked paid)
        makeOrder({
          id: "10000000-0000-4000-8000-000000000004",
          paid: "paid",
          paidAt: "2026-10-05T12:00:00.000Z",
          totalAmount: 5000,
          status: "CANCELLED",
        }),
        // Unpaid order inside window
        makeOrder({
          id: "10000000-0000-4000-8000-000000000005",
          paid: "unpaid",
          paidAt: null,
          totalAmount: 1200,
          status: "CONFIRMED",
          requestedDate: "2026-10-03",
        }),
      ];

      const metrics = calculateKpiMetrics({ orders, expenses: [], period, timeZone: TZ });

      expect(metrics.revenue).toBe(3500); // 2000 + 1500
      expect(metrics.paidOrderCount).toBe(2);
      expect(metrics.averageOrderValue).toBe(1750); // 3500 / 2
    });

    it("falls back to updatedAt/createdAt if paid order has missing paidAt", () => {
      const orders = [
        makeOrder({
          id: "10000000-0000-4000-8000-000000000006",
          paid: "paid",
          paidAt: null,
          updatedAt: "2026-10-04T12:00:00.000Z",
          totalAmount: 1800,
          status: "COMPLETED",
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-00000000006a",
          paid: "paid",
          paidAt: null,
          updatedAt: "" as unknown as string,
          requestedDate: "2026-10-04",
          totalAmount: 500,
          status: "COMPLETED",
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-00000000006b",
          paid: "paid",
          paidAt: null,
          updatedAt: "" as unknown as string,
          requestedDate: "" as unknown as string,
          createdAt: "2026-10-04T08:00:00.000Z",
          totalAmount: 700,
          status: "COMPLETED",
        }),
      ];

      const metrics = calculateKpiMetrics({ orders, expenses: [], period, timeZone: TZ });
      expect(metrics.revenue).toBe(3000);
      expect(metrics.paidOrderCount).toBe(3);
    });

    it("falls back to createdAt when expense has no date or order dates fall back", () => {
      const orders = [
        makeOrder({
          id: "10000000-0000-4000-8000-000000000016",
          status: "COMPLETED",
          updatedAt: "" as unknown as string,
          requestedDate: "2026-10-03",
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-000000000017",
          status: "COMPLETED",
          updatedAt: "" as unknown as string,
          requestedDate: "" as unknown as string,
          createdAt: "2026-10-03T10:00:00.000Z",
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-000000000018",
          status: "CANCELLED",
          updatedAt: "" as unknown as string,
          createdAt: "2026-10-03T10:00:00.000Z",
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-000000000019",
          status: "NEW",
          paid: "unpaid",
          requestedDate: "" as unknown as string,
          createdAt: "2026-10-03T10:00:00.000Z",
          totalAmount: 400,
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-000000000020",
          status: "NEW",
          paid: "unpaid",
          requestedDate: "" as unknown as string,
          createdAt: "" as unknown as string,
          updatedAt: "2026-10-03T10:00:00.000Z",
          totalAmount: 600,
        }),
      ];
      const expenses = [
        makeExpense({
          amount: 250,
          date: "" as unknown as string,
          createdAt: "2026-10-03T10:00:00.000Z",
        }),
      ];

      const metrics = calculateKpiMetrics({ orders, expenses, period, timeZone: TZ });
      expect(metrics.costs).toBe(250);
      expect(metrics.completedOrderCount).toBe(2);
      expect(metrics.cancelledOrderCount).toBe(1);
      expect(metrics.pendingRevenue).toBe(1000);
    });

    it("computes pending revenue for unpaid, non-cancelled orders", () => {
      const orders = [
        makeOrder({
          id: "10000000-0000-4000-8000-000000000007",
          paid: "unpaid",
          totalAmount: 2500,
          status: "CONFIRMED",
          requestedDate: "2026-10-04",
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-000000000008",
          paid: "unpaid",
          totalAmount: 1500,
          status: "NEW",
          requestedDate: "2026-10-06",
        }),
        // Cancelled unpaid order should be excluded from pending revenue
        makeOrder({
          id: "10000000-0000-4000-8000-000000000009",
          paid: "unpaid",
          totalAmount: 9000,
          status: "CANCELLED",
          requestedDate: "2026-10-05",
        }),
        // Unpaid order outside period window
        makeOrder({
          id: "10000000-0000-4000-8000-000000000010",
          paid: "unpaid",
          totalAmount: 4000,
          status: "NEW",
          requestedDate: "2026-10-15",
        }),
      ];

      const metrics = calculateKpiMetrics({ orders, expenses: [], period, timeZone: TZ });

      expect(metrics.pendingRevenue).toBe(4000); // 2500 + 1500 (within period)
      expect(metrics.totalPendingRevenue).toBe(8000); // 2500 + 1500 + 4000 (across all non-cancelled)
    });

    it("counts a refunded order as neither revenue nor pending revenue", () => {
      const orders = [
        makeOrder({
          id: "10000000-0000-4000-8000-000000000031",
          paid: "refunded",
          totalAmount: 3000,
          status: "COMPLETED",
          requestedDate: "2026-10-04",
          paidAt: "2026-10-04T10:00:00.000Z",
          refundedAt: "2026-10-05T10:00:00.000Z",
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-000000000032",
          paid: "refunded",
          totalAmount: 2000,
          status: "CANCELLED",
          requestedDate: "2026-10-04",
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-000000000033",
          paid: "unpaid",
          totalAmount: 500,
          status: "NEW",
          requestedDate: "2026-10-04",
        }),
      ];

      const metrics = calculateKpiMetrics({ orders, expenses: [], period, timeZone: TZ });

      expect(metrics.revenue).toBe(0);
      expect(metrics.pendingRevenue).toBe(500);
      expect(metrics.totalPendingRevenue).toBe(500);
    });

    it("computes costs and profit accurately (including net loss)", () => {
      const orders = [
        makeOrder({
          paid: "paid",
          paidAt: "2026-10-02T10:00:00.000Z",
          totalAmount: 5000,
          status: "COMPLETED",
        }),
      ];

      const expenses = [
        makeExpense({
          amount: 2000,
          date: "2026-10-03",
        }),
        makeExpense({
          amount: 1500,
          date: "2026-10-05T08:00:00.000Z",
        }),
        // Outside period
        makeExpense({
          amount: 8000,
          date: "2026-10-20",
        }),
      ];

      const metrics = calculateKpiMetrics({ orders, expenses, period, timeZone: TZ });

      expect(metrics.revenue).toBe(5000);
      expect(metrics.costs).toBe(3500);
      expect(metrics.profit).toBe(1500); // 5000 - 3500

      // Case with net loss
      const highExpenses = [
        makeExpense({
          amount: 7000,
          date: "2026-10-04",
        }),
      ];
      const lossMetrics = calculateKpiMetrics({
        orders,
        expenses: highExpenses,
        period,
        timeZone: TZ,
      });
      expect(lossMetrics.revenue).toBe(5000);
      expect(lossMetrics.costs).toBe(7000);
      expect(lossMetrics.profit).toBe(-2000);
    });

    it("tracks completed, cancelled, and total closed order counts in period", () => {
      const orders = [
        makeOrder({
          id: "10000000-0000-4000-8000-000000000011",
          status: "COMPLETED",
          updatedAt: "2026-10-02T11:00:00.000Z",
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-000000000012",
          status: "COMPLETED",
          updatedAt: "2026-10-04T15:00:00.000Z",
        }),
        makeOrder({
          id: "10000000-0000-4000-8000-000000000013",
          status: "CANCELLED",
          updatedAt: "2026-10-05T09:00:00.000Z",
        }),
        // Completed outside period
        makeOrder({
          id: "10000000-0000-4000-8000-000000000014",
          status: "COMPLETED",
          updatedAt: "2026-10-12T10:00:00.000Z",
        }),
        // Active orders (neither completed nor cancelled)
        makeOrder({
          id: "10000000-0000-4000-8000-000000000015",
          status: "PREPARING",
          updatedAt: "2026-10-03T10:00:00.000Z",
        }),
      ];

      const metrics = calculateKpiMetrics({ orders, expenses: [], period, timeZone: TZ });

      expect(metrics.completedOrderCount).toBe(2);
      expect(metrics.cancelledOrderCount).toBe(1);
      expect(metrics.totalClosedOrderCount).toBe(3);
    });

    it("handles empty arrays gracefully with zero counts and zero AOV", () => {
      const metrics = calculateKpiMetrics({ orders: [], expenses: [], period, timeZone: TZ });

      expect(metrics).toEqual({
        revenue: 0,
        pendingRevenue: 0,
        totalPendingRevenue: 0,
        costs: 0,
        profit: 0,
        paidOrderCount: 0,
        completedOrderCount: 0,
        cancelledOrderCount: 0,
        totalClosedOrderCount: 0,
        averageOrderValue: 0,
      });
    });
  });

  describe("calculateKpiDelta", () => {
    it("calculates positive delta and percentage correctly", () => {
      const delta = calculateKpiDelta(150, 100);
      expect(delta).toEqual({
        absolute: 50,
        percentage: 50,
      });
    });

    it("calculates negative delta and percentage correctly", () => {
      const delta = calculateKpiDelta(80, 100);
      expect(delta).toEqual({
        absolute: -20,
        percentage: -20,
      });
    });

    it("returns null percentage when previous period is 0", () => {
      expect(calculateKpiDelta(100, 0)).toEqual({
        absolute: 100,
        percentage: null,
      });
      expect(calculateKpiDelta(0, 0)).toEqual({
        absolute: 0,
        percentage: null,
      });
    });

    it("calculates percentage delta correctly when previous value is negative", () => {
      // From -100 to +50: difference is +150, relative to |-100| is +150%
      const delta = calculateKpiDelta(50, -100);
      expect(delta).toEqual({
        absolute: 150,
        percentage: 150,
      });
    });
  });

  describe("calculateKpiReport", () => {
    const period: DateRange = {
      startDate: "2026-10-08",
      endDate: "2026-10-14",
    };

    it("generates full report with current period, automatically shifted previous period, and deltas", () => {
      const orders = [
        // Current period order (paid on Oct 10)
        makeOrder({
          paid: "paid",
          paidAt: "2026-10-10T10:00:00.000Z",
          totalAmount: 2000,
          status: "COMPLETED",
          updatedAt: "2026-10-10T11:00:00.000Z",
        }),
        // Previous period order (paid on Oct 3: inside Oct 01 - Oct 07)
        makeOrder({
          paid: "paid",
          paidAt: "2026-10-03T10:00:00.000Z",
          totalAmount: 1000,
          status: "COMPLETED",
          updatedAt: "2026-10-03T11:00:00.000Z",
        }),
      ];

      const report = calculateKpiReport({
        timeZone: TZ,
        orders,
        expenses: [],
        period,
      });

      expect(report.period).toEqual(period);
      expect(report.previousPeriod).toEqual({
        startDate: "2026-10-01",
        endDate: "2026-10-07",
      });

      expect(report.current.revenue).toBe(2000);
      expect(report.previous?.revenue).toBe(1000);
      expect(report.deltas?.revenue).toEqual({
        absolute: 1000,
        percentage: 100,
      });
    });

    it("allows disabling previous period comparison", () => {
      const report = calculateKpiReport({
        timeZone: TZ,
        orders: [],
        expenses: [],
        period,
        compareWithPrevious: false,
      });

      expect(report.previousPeriod).toBeNull();
      expect(report.previous).toBeNull();
      expect(report.deltas).toBeNull();
    });
  });

  describe("KPI schemas and defaults", () => {
    it("validates valid DateRange", () => {
      const valid = { startDate: "2026-10-01", endDate: "2026-10-05" };
      expect(dateRangeSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects DateRange where startDate > endDate", () => {
      const invalid = { startDate: "2026-10-05", endDate: "2026-10-01" };
      expect(dateRangeSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects DateRange with malformed date strings", () => {
      expect(
        dateRangeSchema.safeParse({ startDate: "invalid", endDate: "2026-10-05" }).success,
      ).toBe(false);
    });

    it("validates full KpiReport schema", () => {
      const report = calculateKpiReport({
        timeZone: TZ,
        orders: [],
        expenses: [],
        period: { startDate: "2026-10-01", endDate: "2026-10-05" },
      });
      expect(kpiReportSchema.safeParse(report).success).toBe(true);
    });
  });
});

describe("KPI ranges in the business time zone (#168)", () => {
  const PARIS = "Europe/Paris";

  it("extractDate assigns a timestamp to the business calendar day", () => {
    // 22:30 UTC on 9 Oct is 00:30 on the 10th in Paris, still the 9th in New York
    expect(extractDate("2026-10-09T22:30:00.000Z", PARIS)).toBe("2026-10-10");
    expect(extractDate("2026-10-09T22:30:00.000Z", "America/New_York")).toBe("2026-10-09");
    expect(extractDate(new Date("2026-10-09T22:30:00.000Z"), PARIS)).toBe("2026-10-10");
    expect(extractDate("2026-10-09T22:30:00+02:00", PARIS)).toBe("2026-10-09");
    // A bare calendar day has no zone and is never shifted
    expect(extractDate("2026-10-09", PARIS)).toBe("2026-10-09");
    // A timestamp without an offset is read as UTC
    expect(extractDate("2026-10-09T22:30:00", PARIS)).toBe("2026-10-10");
    expect(() => extractDate("2026-10-09Tgarbage", PARIS)).toThrow("Invalid date values");
  });

  it("resolves 'today' from the instant on the local calendar", () => {
    const justAfterLocalMidnight = new Date("2026-10-09T22:30:00Z");
    expect(resolveDateRange("today", justAfterLocalMidnight, PARIS)).toEqual({
      startDate: "2026-10-10",
      endDate: "2026-10-10",
    });
    expect(resolveDateRange("today", justAfterLocalMidnight, "UTC")).toEqual({
      startDate: "2026-10-09",
      endDate: "2026-10-09",
    });
  });

  it("resolves week and month presets across the local month end and DST", () => {
    // 23:30 UTC on 31 Oct is already 1 Nov in Paris
    const ref = new Date("2026-10-31T23:30:00Z");
    expect(resolveDateRange("this_month", ref, PARIS)).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });
    expect(resolveDateRange("last_month", ref, PARIS)).toEqual({
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    });
    expect(resolveDateRange("last_7_days", ref, PARIS)).toEqual({
      startDate: "2026-10-26",
      endDate: "2026-11-01",
    });
    // The fall-back Sunday (25 Oct) is a single calendar day in the range
    expect(resolveDateRange("last_7_days", new Date("2026-10-26T10:00:00Z"), PARIS)).toEqual({
      startDate: "2026-10-20",
      endDate: "2026-10-26",
    });
  });

  it("counts an order paid after local midnight in the next day's revenue", () => {
    const order = makeOrder({
      paidAt: "2026-10-09T22:30:00.000Z", // 00:30 on the 10th in Paris
      totalAmount: 2000,
    });
    const parisDay = { startDate: "2026-10-10", endDate: "2026-10-10" };
    const utcDay = { startDate: "2026-10-09", endDate: "2026-10-09" };

    expect(
      calculateKpiMetrics({ orders: [order], expenses: [], period: parisDay, timeZone: PARIS })
        .revenue,
    ).toBe(2000);
    expect(
      calculateKpiMetrics({ orders: [order], expenses: [], period: utcDay, timeZone: PARIS })
        .revenue,
    ).toBe(0);
    expect(
      calculateKpiMetrics({ orders: [order], expenses: [], period: utcDay, timeZone: "UTC" })
        .revenue,
    ).toBe(2000);
  });
});

describe("presentKpiDelta", () => {
  it("signs the change by the value and judges it by the metric", () => {
    expect(presentKpiDelta("revenue", 12.5)).toEqual({
      direction: "up",
      sentiment: "good",
      magnitude: 12.5,
    });
    expect(presentKpiDelta("revenue", -3)).toEqual({
      direction: "down",
      sentiment: "bad",
      magnitude: 3,
    });
  });

  it("treats lower costs and fewer cancellations as favourable", () => {
    expect(presentKpiDelta("costs", -5.2)).toEqual({
      direction: "down",
      sentiment: "good",
      magnitude: 5.2,
    });
    expect(presentKpiDelta("costs", 8)).toEqual({
      direction: "up",
      sentiment: "bad",
      magnitude: 8,
    });
    expect(presentKpiDelta("cancelledOrderCount", -10)?.sentiment).toBe("good");
  });

  it("is flat and neutral at zero, and absent without a comparable value", () => {
    expect(presentKpiDelta("costs", 0)).toEqual({
      direction: "flat",
      sentiment: "neutral",
      magnitude: 0,
    });
    expect(presentKpiDelta("profit", null)).toBeNull();
    expect(presentKpiDelta("profit", undefined)).toBeNull();
    expect(presentKpiDelta("profit", Number.NaN)).toBeNull();
  });
});
