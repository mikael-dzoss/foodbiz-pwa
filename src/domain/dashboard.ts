import { z } from "zod";
import { type DateRange, calculateKpiReport, resolveDateRange } from "./kpis";
import type { Expense } from "./expense";
import type { Order, OrderStatus } from "./order";
import type { Product } from "./product";
import { type StockLevelStatus, getStockStatus } from "./stock";

export const dashboardPeriodPresetSchema = z.enum([
  "today",
  "last_7_days",
  "last_30_days",
  "this_month",
]);

export type DashboardPeriodPreset = z.infer<typeof dashboardPeriodPresetSchema>;

export interface ToPrepareOrderItem {
  readonly id: string;
  readonly orderNumber?: number;
  readonly guestName: string;
  readonly status: OrderStatus;
  readonly totalAmount: number;
  readonly itemCount: number;
  readonly itemsSummary: string;
  readonly requestedDate: string;
  readonly requestedTime?: string | null;
  readonly createdAt: string;
}

export interface UnpaidOrderSummaryItem {
  readonly id: string;
  readonly orderNumber?: number;
  readonly guestName: string;
  readonly totalAmount: number;
  readonly requestedDate: string;
  readonly createdAt: string;
}

export interface LowStockProductItem {
  readonly id: string;
  readonly name: string;
  readonly stock: number;
  readonly price: number;
  readonly unitCost: number;
  readonly status: StockLevelStatus;
}

export interface OperationalTriage {
  readonly toPrepare: {
    readonly count: number;
    readonly items: readonly ToPrepareOrderItem[];
  };
  readonly unpaid: {
    readonly count: number;
    readonly totalAmount: number;
    readonly items: readonly UnpaidOrderSummaryItem[];
  };
  readonly lowStock: {
    readonly count: number;
    readonly items: readonly LowStockProductItem[];
  };
}

export type ActivityItemVariant =
  "paid" | "unpaid" | "expense" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

export interface ActivityFeedItem {
  readonly id: string;
  readonly type: "order" | "expense";
  readonly title: string;
  readonly subtitle?: string;
  readonly amount: number;
  readonly timestamp: string;
  readonly statusLabel: string;
  readonly statusVariant: ActivityItemVariant;
  readonly href: string;
}

export interface DashboardData {
  readonly periodPreset: DashboardPeriodPreset;
  readonly period: DateRange;
  readonly kpis: ReturnType<typeof calculateKpiReport>;
  readonly triage: OperationalTriage;
  readonly activity: readonly ActivityFeedItem[];
}

/**
 * Extracts active orders that require kitchen preparation (CONFIRMED or PREPARING).
 * Sorted by scheduled due date & time ascending.
 */
export function extractOrdersToPrepare(
  orders: readonly Order[],
  limit = 5,
): { count: number; items: ToPrepareOrderItem[] } {
  const filtered = orders.filter((o) => o.status === "CONFIRMED" || o.status === "PREPARING");

  const sorted = [...filtered].sort((a, b) => {
    const aKey = `${a.requestedDate}T${a.requestedTime || "00:00"}`;
    const bKey = `${b.requestedDate}T${b.requestedTime || "00:00"}`;
    return aKey.localeCompare(bKey);
  });

  const items: ToPrepareOrderItem[] = sorted.slice(0, limit).map((o) => {
    const itemCount = o.items.reduce((sum, it) => sum + it.quantity, 0);
    const itemsSummary = o.items.map((it) => `${it.quantity}x ${it.productName}`).join(", ");
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      guestName: o.guestName,
      status: o.status,
      totalAmount: o.totalAmount,
      itemCount,
      itemsSummary,
      requestedDate: o.requestedDate,
      requestedTime: o.requestedTime,
      createdAt: o.createdAt,
    };
  });

  return {
    count: filtered.length,
    items,
  };
}

/**
 * Extracts unpaid, active (non-cancelled) orders with total outstanding amount.
 */
export function extractUnpaidOrders(
  orders: readonly Order[],
  limit = 5,
): { count: number; totalAmount: number; items: UnpaidOrderSummaryItem[] } {
  const filtered = orders.filter((o) => o.paid === "unpaid" && o.status !== "CANCELLED");

  const totalAmount = filtered.reduce((sum, o) => sum + o.totalAmount, 0);

  const sorted = [...filtered].sort((a, b) => {
    return b.createdAt.localeCompare(a.createdAt);
  });

  const items: UnpaidOrderSummaryItem[] = sorted.slice(0, limit).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    guestName: o.guestName,
    totalAmount: o.totalAmount,
    requestedDate: o.requestedDate,
    createdAt: o.createdAt,
  }));

  return {
    count: filtered.length,
    totalAmount,
    items,
  };
}

/**
 * Extracts products that are low or out of stock.
 * Sorted by stock quantity ascending.
 */
export function extractLowStockProducts(
  products: readonly Product[],
  threshold = 5,
  limit = 5,
): { count: number; items: LowStockProductItem[] } {
  const lowOrOut = products.filter((p) => {
    const status = getStockStatus(p.stock, threshold);
    return status === "low_stock" || status === "out_of_stock";
  });

  const sorted = [...lowOrOut].sort((a, b) => a.stock - b.stock);

  const items: LowStockProductItem[] = sorted.slice(0, limit).map((p) => ({
    id: p.id,
    name: p.name,
    stock: p.stock,
    price: p.price,
    unitCost: p.unitCost,
    status: getStockStatus(p.stock, threshold),
  }));

  return {
    count: lowOrOut.length,
    items,
  };
}

/**
 * Merges latest orders and expenses into a single unified chronological feed, newest first.
 */
export function buildActivityFeed(
  orders: readonly Order[],
  expenses: readonly Expense[],
  limit = 10,
): ActivityFeedItem[] {
  const orderItems: ActivityFeedItem[] = orders.map((o) => {
    const timestamp = o.createdAt || `${o.requestedDate}T12:00:00.000Z`;
    const title = o.orderNumber ? `Order #${o.orderNumber}` : `Order (${o.guestName})`;
    let subtitle = o.guestName;
    if (o.paid === "paid") {
      subtitle = o.paymentMethod
        ? `${o.guestName} · Paid (${o.paymentMethod})`
        : `${o.guestName} · Paid`;
    } else {
      subtitle = `${o.guestName} · Unpaid`;
    }

    const statusVariant: ActivityItemVariant =
      o.status === "CANCELLED" ? "cancelled" : o.paid === "paid" ? "paid" : "unpaid";

    const statusLabel =
      o.status === "CANCELLED"
        ? "Cancelled"
        : o.paid === "paid"
          ? "Paid"
          : o.status === "CONFIRMED"
            ? "Confirmed"
            : o.status === "PREPARING"
              ? "Preparing"
              : "Unpaid";

    return {
      id: o.id,
      type: "order",
      title,
      subtitle,
      amount: o.totalAmount,
      timestamp,
      statusLabel,
      statusVariant,
      href: `/manage/orders/${o.id}`,
    };
  });

  const expenseItems: ActivityFeedItem[] = expenses.map((e) => {
    const timestamp = e.createdAt || `${e.date}T12:00:00.000Z`;
    const tagString = e.tags && e.tags.length > 0 ? e.tags.join(", ") : undefined;
    return {
      id: e.id,
      type: "expense",
      title: e.description,
      subtitle: tagString,
      amount: e.amount,
      timestamp,
      statusLabel: "Expense",
      statusVariant: "expense",
      href: "/manage/expenses",
    };
  });

  const combined = [...orderItems, ...expenseItems];
  combined.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return combined.slice(0, limit);
}

export interface BuildDashboardDataInput {
  orders: readonly Order[];
  expenses: readonly Expense[];
  products: readonly Product[];
  periodPreset?: DashboardPeriodPreset;
  referenceDate?: string | Date;
}

/**
 * Builds all data required by the manager dashboard for a given period preset.
 */
export function buildDashboardData(input: BuildDashboardDataInput): DashboardData {
  const periodPreset = input.periodPreset ?? "today";
  const period = resolveDateRange(periodPreset, input.referenceDate);
  const kpis = calculateKpiReport({
    orders: input.orders,
    expenses: input.expenses,
    period,
    compareWithPrevious: true,
  });

  const triage: OperationalTriage = {
    toPrepare: extractOrdersToPrepare(input.orders),
    unpaid: extractUnpaidOrders(input.orders),
    lowStock: extractLowStockProducts(input.products),
  };

  const activity = buildActivityFeed(input.orders, input.expenses, 10);

  return {
    periodPreset,
    period,
    kpis,
    triage,
    activity,
  };
}
