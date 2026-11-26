import type { Business, BusinessMember, BusinessSettings } from "@/domain/business";
import type { Expense } from "@/domain/expense";
import type { Guest } from "@/domain/guest";
import type { Order } from "@/domain/order";
import type { PickupLocation } from "@/domain/pickup-location";
import type { Product, ProductCategory } from "@/domain/product";

import {
  DEMO_BUSINESS_ID,
  DEMO_MANAGER_USER_ID,
  DEMO_OWNER_USER_ID,
  demoBusiness,
  demoMembers,
  demoSettings,
} from "./business";
import { DEMO_CATEGORY_IDS, demoCategories } from "./categories";
import { demoExpenses } from "./expenses";
import { demoGuests } from "./guests";
import { demoOrders } from "./orders";
import { DEMO_PRODUCT, demoProducts, type DemoProductKey } from "./products";

export interface MockFixtures {
  business: Business;
  settings: BusinessSettings;
  members: BusinessMember[];
  categories: ProductCategory[];
  products: Product[];
  guests: Guest[];
  expenses: Expense[];
  orders: Order[];
  pickupLocations: PickupLocation[];
}

export function createDefaultFixtures(now: Date = new Date()): MockFixtures {
  // Keep the fixed historical fixtures intact; date-shift four recent orders at creation time.
  const recentOrders = demoOrders.slice(-4);
  const anchor = Date.parse(recentOrders[recentOrders.length - 1].createdAt);
  const shift = now.getTime() - 3_600_000 - anchor;
  const shiftDate = (date: string) => new Date(Date.parse(date) + shift).toISOString();
  return {
    business: structuredClone(demoBusiness),
    settings: structuredClone(demoSettings),
    members: structuredClone(demoMembers),
    categories: structuredClone(demoCategories),
    products: structuredClone(demoProducts),
    guests: structuredClone(demoGuests),
    expenses: structuredClone(demoExpenses),
    pickupLocations: [],
    orders: structuredClone(demoOrders).map((order) =>
      recentOrders.some((recent) => recent.id === order.id)
        ? {
            ...order,
            createdAt: shiftDate(order.createdAt),
            updatedAt: shiftDate(order.updatedAt),
            requestedDate: shiftDate(order.createdAt).slice(0, 10),
            paidAt: order.paidAt ? shiftDate(order.paidAt) : order.paidAt,
            refundedAt: order.refundedAt ? shiftDate(order.refundedAt) : order.refundedAt,
            statusHistory: order.statusHistory?.map((event) => ({
              ...event,
              timestamp: shiftDate(event.timestamp),
            })),
          }
        : order,
    ),
  };
}

export {
  DEMO_BUSINESS_ID,
  DEMO_CATEGORY_IDS,
  DEMO_MANAGER_USER_ID,
  DEMO_OWNER_USER_ID,
  DEMO_PRODUCT,
  demoBusiness,
  demoCategories,
  demoExpenses,
  demoGuests,
  demoMembers,
  demoOrders,
  demoProducts,
  demoSettings,
};
export type { DemoProductKey };
