import type { Business, BusinessMember, BusinessSettings } from "@/domain/business";
import type { Expense } from "@/domain/expense";
import type { Guest } from "@/domain/guest";
import type { Order } from "@/domain/order";
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
import { demoProducts } from "./products";

export interface MockFixtures {
  business: Business;
  settings: BusinessSettings;
  members: BusinessMember[];
  categories: ProductCategory[];
  products: Product[];
  guests: Guest[];
  expenses: Expense[];
  orders: Order[];
}

export function createDefaultFixtures(): MockFixtures {
  return {
    business: structuredClone(demoBusiness),
    settings: structuredClone(demoSettings),
    members: structuredClone(demoMembers),
    categories: structuredClone(demoCategories),
    products: structuredClone(demoProducts),
    guests: structuredClone(demoGuests),
    expenses: structuredClone(demoExpenses),
    orders: structuredClone(demoOrders),
  };
}

export {
  DEMO_BUSINESS_ID,
  DEMO_CATEGORY_IDS,
  DEMO_MANAGER_USER_ID,
  DEMO_OWNER_USER_ID,
  demoBusiness,
  demoCategories,
  demoExpenses,
  demoGuests,
  demoMembers,
  demoOrders,
  demoProducts,
  demoSettings,
};
