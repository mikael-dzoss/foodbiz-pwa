import { z } from "zod";
import { isoDateSchema, moneySchema } from "./common";
import type { Expense } from "./expense";
import type { Order } from "./order";
import { getZonedDay } from "./timezone";

export const dateRangeSchema = z
  .object({
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .refine((range) => range.startDate <= range.endDate, {
    error: "startDate must be before or equal to endDate",
  });

export type DateRange = z.infer<typeof dateRangeSchema>;

export const kpiPeriodPresetSchema = z.enum([
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
]);

export type KpiPeriodPreset = z.infer<typeof kpiPeriodPresetSchema>;

export const kpiMetricsSchema = z.object({
  revenue: moneySchema,
  pendingRevenue: moneySchema,
  totalPendingRevenue: moneySchema,
  costs: moneySchema,
  profit: z.number().int(),
  paidOrderCount: z.number().int().min(0),
  completedOrderCount: z.number().int().min(0),
  cancelledOrderCount: z.number().int().min(0),
  totalClosedOrderCount: z.number().int().min(0),
  averageOrderValue: moneySchema,
});

export type KpiMetrics = z.infer<typeof kpiMetricsSchema>;

export const kpiMetricDeltaSchema = z.object({
  absolute: z.number().int(),
  percentage: z.number().nullable(),
});

export type KpiMetricDelta = z.infer<typeof kpiMetricDeltaSchema>;

export const kpiReportSchema = z.object({
  period: dateRangeSchema,
  previousPeriod: dateRangeSchema.nullable(),
  current: kpiMetricsSchema,
  previous: kpiMetricsSchema.nullable(),
  deltas: z
    .object({
      revenue: kpiMetricDeltaSchema,
      pendingRevenue: kpiMetricDeltaSchema,
      costs: kpiMetricDeltaSchema,
      profit: kpiMetricDeltaSchema,
      paidOrderCount: kpiMetricDeltaSchema,
      completedOrderCount: kpiMetricDeltaSchema,
      cancelledOrderCount: kpiMetricDeltaSchema,
      totalClosedOrderCount: kpiMetricDeltaSchema,
      averageOrderValue: kpiMetricDeltaSchema,
    })
    .nullable(),
});

export type KpiReport = z.infer<typeof kpiReportSchema>;

/**
 * Normalizes a date string or instant into the calendar day (YYYY-MM-DD) it falls on in
 * `timeZone` (the business zone). A bare date string is already a calendar day and is returned
 * as is; a timestamp without an offset is read as UTC.
 */
export function extractDate(value: string | Date, timeZone: string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("Invalid date object");
    }
    return getZonedDay(value, timeZone);
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
    if (!match) {
      throw new Error(`Invalid date format: ${value}`);
    }
    const [, y, m, d, rest] = match;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    const testDate = new Date(Date.UTC(year, month - 1, day));
    if (
      Number.isNaN(testDate.getTime()) ||
      testDate.getUTCFullYear() !== year ||
      testDate.getUTCMonth() !== month - 1 ||
      testDate.getUTCDate() !== day
    ) {
      throw new Error(`Invalid date values: ${value}`);
    }
    if (rest === "") return `${y}-${m}-${d}`;
    const hasOffset = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(rest);
    const instant = new Date(hasOffset ? value : `${value}Z`);
    if (Number.isNaN(instant.getTime())) {
      throw new Error(`Invalid date values: ${value}`);
    }
    return getZonedDay(instant, timeZone);
  }

  throw new Error("Value must be a string or Date object");
}

function formatDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysUtc(d: Date, days: number): Date {
  const res = new Date(d.getTime());
  res.setUTCDate(res.getUTCDate() + days);
  return res;
}

/**
 * Resolves a date preset into a DateRange of calendar days in `timeZone`. `referenceDate` is the
 * current instant (or a bare YYYY-MM-DD day); the caller supplies it, domain code never reads the
 * clock.
 */
export function resolveDateRange(
  preset: KpiPeriodPreset,
  referenceDate: string | Date,
  timeZone: string,
): DateRange {
  const refStr = extractDate(referenceDate, timeZone);
  const [refY, refM, refD] = refStr.split("-").map((n) => parseInt(n, 10));
  const refUtc = new Date(Date.UTC(refY, refM - 1, refD));

  switch (preset) {
    case "today":
      return { startDate: refStr, endDate: refStr };
    case "yesterday": {
      const yest = formatDateUtc(addDaysUtc(refUtc, -1));
      return { startDate: yest, endDate: yest };
    }
    case "last_7_days": {
      const start = formatDateUtc(addDaysUtc(refUtc, -6));
      return { startDate: start, endDate: refStr };
    }
    case "last_30_days": {
      const start = formatDateUtc(addDaysUtc(refUtc, -29));
      return { startDate: start, endDate: refStr };
    }
    case "this_month": {
      const startOfMonth = new Date(Date.UTC(refY, refM - 1, 1));
      const endOfMonth = new Date(Date.UTC(refY, refM, 0));
      return {
        startDate: formatDateUtc(startOfMonth),
        endDate: formatDateUtc(endOfMonth),
      };
    }
    case "last_month": {
      const startOfLastMonth = new Date(Date.UTC(refY, refM - 2, 1));
      const endOfLastMonth = new Date(Date.UTC(refY, refM - 1, 0));
      return {
        startDate: formatDateUtc(startOfLastMonth),
        endDate: formatDateUtc(endOfLastMonth),
      };
    }
  }
}

/**
 * Returns a preceding DateRange of identical day duration shifted directly backward.
 */
export function getPreviousDateRange(period: DateRange): DateRange {
  const [startY, startM, startD] = period.startDate.split("-").map((n) => parseInt(n, 10));
  const [endY, endM, endD] = period.endDate.split("-").map((n) => parseInt(n, 10));

  const startUtc = new Date(Date.UTC(startY, startM - 1, startD));
  const endUtc = new Date(Date.UTC(endY, endM - 1, endD));

  const dayMs = 24 * 60 * 60 * 1000;
  const dayCount = Math.round((endUtc.getTime() - startUtc.getTime()) / dayMs) + 1;

  const prevEndUtc = new Date(startUtc.getTime() - dayMs);
  const prevStartUtc = new Date(startUtc.getTime() - dayCount * dayMs);

  return {
    startDate: formatDateUtc(prevStartUtc),
    endDate: formatDateUtc(prevEndUtc),
  };
}

function isDateInPeriod(dateStr: string, period: DateRange): boolean {
  return dateStr >= period.startDate && dateStr <= period.endDate;
}

function getOrderPaidDate(order: Order, timeZone: string): string | null {
  if (order.paid !== "paid") return null;
  if (order.paidAt) return extractDate(order.paidAt, timeZone);
  if (order.updatedAt) return extractDate(order.updatedAt, timeZone);
  if (order.requestedDate) return extractDate(order.requestedDate, timeZone);
  if (order.createdAt) return extractDate(order.createdAt, timeZone);
  return null;
}

function getOrderCompletedDate(order: Order, timeZone: string): string | null {
  if (order.status !== "COMPLETED") return null;
  if (order.updatedAt) return extractDate(order.updatedAt, timeZone);
  if (order.requestedDate) return extractDate(order.requestedDate, timeZone);
  if (order.createdAt) return extractDate(order.createdAt, timeZone);
  return null;
}

function getOrderCancelledDate(order: Order, timeZone: string): string | null {
  if (order.status !== "CANCELLED") return null;
  if (order.updatedAt) return extractDate(order.updatedAt, timeZone);
  if (order.createdAt) return extractDate(order.createdAt, timeZone);
  return null;
}

function getOrderPendingDate(order: Order, timeZone: string): string | null {
  if (order.status === "CANCELLED" || order.paid === "paid") return null;
  if (order.requestedDate) return extractDate(order.requestedDate, timeZone);
  if (order.createdAt) return extractDate(order.createdAt, timeZone);
  if (order.updatedAt) return extractDate(order.updatedAt, timeZone);
  return null;
}

function getExpenseDate(expense: Expense, timeZone: string): string {
  if (expense.date) return extractDate(expense.date, timeZone);
  return extractDate(expense.createdAt, timeZone);
}

export interface CalculateKpiMetricsInput {
  orders: readonly Order[];
  expenses: readonly Expense[];
  period: DateRange;
  /** Business time zone: decides which calendar day each timestamp belongs to. */
  timeZone: string;
}

/**
 * Calculates cash-basis KPI metrics for a given period.
 */
export function calculateKpiMetrics(input: CalculateKpiMetricsInput): KpiMetrics {
  const { orders, expenses, period, timeZone } = input;

  let revenue = 0;
  let paidOrderCount = 0;
  let pendingRevenue = 0;
  let totalPendingRevenue = 0;
  let completedOrderCount = 0;
  let cancelledOrderCount = 0;
  let costs = 0;

  for (const order of orders) {
    if (order.status !== "CANCELLED") {
      if (order.paid === "paid") {
        const paidDate = getOrderPaidDate(order, timeZone);
        if (paidDate && isDateInPeriod(paidDate, period)) {
          revenue += order.totalAmount;
          paidOrderCount += 1;
        }
      } else if (order.paid === "unpaid") {
        // A refunded order is neither revenue nor pending: the money went back.
        totalPendingRevenue += order.totalAmount;
        const pendingDate = getOrderPendingDate(order, timeZone);
        if (pendingDate && isDateInPeriod(pendingDate, period)) {
          pendingRevenue += order.totalAmount;
        }
      }
    }

    const completedDate = getOrderCompletedDate(order, timeZone);
    if (completedDate && isDateInPeriod(completedDate, period)) {
      completedOrderCount += 1;
    }

    const cancelledDate = getOrderCancelledDate(order, timeZone);
    if (cancelledDate && isDateInPeriod(cancelledDate, period)) {
      cancelledOrderCount += 1;
    }
  }

  for (const expense of expenses) {
    const expenseDate = getExpenseDate(expense, timeZone);
    if (isDateInPeriod(expenseDate, period)) {
      costs += expense.amount;
    }
  }

  const profit = revenue - costs;
  const totalClosedOrderCount = completedOrderCount + cancelledOrderCount;
  const averageOrderValue = paidOrderCount > 0 ? Math.round(revenue / paidOrderCount) : 0;

  return {
    revenue,
    pendingRevenue,
    totalPendingRevenue,
    costs,
    profit,
    paidOrderCount,
    completedOrderCount,
    cancelledOrderCount,
    totalClosedOrderCount,
    averageOrderValue,
  };
}

/**
 * Computes absolute and percentage delta between current and previous metric values.
 */
export function calculateKpiDelta(current: number, previous: number): KpiMetricDelta {
  const absolute = current - previous;
  if (previous === 0) {
    return { absolute, percentage: null };
  }
  const percentage = Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100;
  return { absolute, percentage };
}

export interface CalculateKpiReportInput {
  orders: readonly Order[];
  expenses: readonly Expense[];
  period: DateRange;
  previousPeriod?: DateRange | null;
  compareWithPrevious?: boolean;
  timeZone: string;
}

/**
 * Generates a full KPI report with current metrics, preceding period metrics, and deltas.
 */
export function calculateKpiReport(input: CalculateKpiReportInput): KpiReport {
  const current = calculateKpiMetrics({
    orders: input.orders,
    expenses: input.expenses,
    period: input.period,
    timeZone: input.timeZone,
  });

  const compare = input.compareWithPrevious ?? true;
  if (!compare) {
    return {
      period: input.period,
      previousPeriod: null,
      current,
      previous: null,
      deltas: null,
    };
  }

  const prevPeriod = input.previousPeriod ?? getPreviousDateRange(input.period);
  const previous = calculateKpiMetrics({
    orders: input.orders,
    expenses: input.expenses,
    period: prevPeriod,
    timeZone: input.timeZone,
  });

  const deltas = {
    revenue: calculateKpiDelta(current.revenue, previous.revenue),
    pendingRevenue: calculateKpiDelta(current.pendingRevenue, previous.pendingRevenue),
    costs: calculateKpiDelta(current.costs, previous.costs),
    profit: calculateKpiDelta(current.profit, previous.profit),
    paidOrderCount: calculateKpiDelta(current.paidOrderCount, previous.paidOrderCount),
    completedOrderCount: calculateKpiDelta(
      current.completedOrderCount,
      previous.completedOrderCount,
    ),
    cancelledOrderCount: calculateKpiDelta(
      current.cancelledOrderCount,
      previous.cancelledOrderCount,
    ),
    totalClosedOrderCount: calculateKpiDelta(
      current.totalClosedOrderCount,
      previous.totalClosedOrderCount,
    ),
    averageOrderValue: calculateKpiDelta(current.averageOrderValue, previous.averageOrderValue),
  };

  return {
    period: input.period,
    previousPeriod: prevPeriod,
    current,
    previous,
    deltas,
  };
}
