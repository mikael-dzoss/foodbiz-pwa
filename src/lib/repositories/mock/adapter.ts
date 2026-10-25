import type { Business, BusinessMember } from "@/domain/business";
import type { Expense } from "@/domain/expense";
import {
  findOrCreateGuest,
  isGuestPhoneUnique,
  normalizeGuestName,
  normalizePhoneNumber,
} from "@/domain/guest";
import type { Guest } from "@/domain/guest";
import type { Order } from "@/domain/order";
import type { Product, ProductCategory } from "@/domain/product";
import type {
  BusinessRepository,
  CategoryRepository,
  ExpenseRepository,
  GuestRepository,
  MemberRepository,
  OrderRepository,
  ProductRepository,
  Repositories,
} from "@/domain/repositories";
import { createDefaultFixtures, type MockFixtures } from "./fixtures";

export interface MockRepositories extends Repositories {
  reset(customFixtures?: MockFixtures): void;
}

function findIndexOrThrow<T>(list: readonly T[], pred: (item: T) => boolean, msg: string): number {
  const idx = list.findIndex(pred);
  if (idx === -1) throw new Error(msg);
  return idx;
}

export function createMockRepositories(
  initialFixtures: MockFixtures = createDefaultFixtures(),
): MockRepositories {
  let fixtures: MockFixtures = structuredClone(initialFixtures);
  const reset = (custom?: MockFixtures): void => {
    fixtures = custom ? structuredClone(custom) : createDefaultFixtures();
  };

  const products: ProductRepository = {
    async findById(bId, id) {
      const p = fixtures.products.find((x) => x.businessId === bId && x.id === id);
      return p ? structuredClone(p) : null;
    },
    async list(bId, filter) {
      let res = fixtures.products.filter((p) => p.businessId === bId);
      if (filter?.categoryId) res = res.filter((p) => p.categoryId === filter.categoryId);
      if (filter?.visibleOnly) res = res.filter((p) => p.visible === true);
      return structuredClone(res);
    },
    async create(bId, input) {
      const now = new Date().toISOString();
      const p: Product = {
        id: input.id ?? crypto.randomUUID(),
        businessId: bId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description ?? null,
        price: input.price,
        unitCost: input.unitCost ?? 0,
        stock: input.stock ?? 0,
        visible: input.visible ?? true,
        imageUrl: input.imageUrl ?? null,
        createdAt: now,
        updatedAt: now,
      };
      fixtures.products.push(p);
      return structuredClone(p);
    },
    async update(bId, id, input) {
      const idx = findIndexOrThrow(
        fixtures.products,
        (p) => p.businessId === bId && p.id === id,
        `Product ${id} not found`,
      );
      const updated = { ...fixtures.products[idx], ...input, updatedAt: new Date().toISOString() };
      fixtures.products[idx] = updated;
      return structuredClone(updated);
    },
    async softDelete(bId, id) {
      return products.update(bId, id, { visible: false });
    },
  };

  const categories: CategoryRepository = {
    async findById(bId, id) {
      const c = fixtures.categories.find((x) => x.businessId === bId && x.id === id);
      return c ? structuredClone(c) : null;
    },
    async list(bId) {
      return structuredClone(
        fixtures.categories
          .filter((c) => c.businessId === bId)
          .toSorted((a, b) => a.sortOrder - b.sortOrder),
      );
    },
    async create(bId, input) {
      const c: ProductCategory = {
        id: input.id ?? crypto.randomUUID(),
        businessId: bId,
        name: input.name,
        sortOrder: input.sortOrder ?? fixtures.categories.length + 1,
        createdAt: new Date().toISOString(),
      };
      fixtures.categories.push(c);
      return structuredClone(c);
    },
    async update(bId, id, input) {
      const idx = findIndexOrThrow(
        fixtures.categories,
        (c) => c.businessId === bId && c.id === id,
        `Category ${id} not found`,
      );
      const updated = { ...fixtures.categories[idx], ...input };
      fixtures.categories[idx] = updated;
      return structuredClone(updated);
    },
    async delete(bId, id) {
      const idx = findIndexOrThrow(
        fixtures.categories,
        (c) => c.businessId === bId && c.id === id,
        `Category ${id} not found`,
      );
      fixtures.categories.splice(idx, 1);
    },
  };

  const orders: OrderRepository = {
    async findById(bId, id) {
      const o = fixtures.orders.find((x) => x.businessId === bId && x.id === id);
      return o ? structuredClone(o) : null;
    },
    async findByTrackingToken(token) {
      const o = fixtures.orders.find((x) => x.trackingToken === token);
      return o ? structuredClone(o) : null;
    },
    async findByTicketAndPhone(bId, orderNumber, phone) {
      let targetPhone: string;
      try {
        targetPhone = normalizePhoneNumber(phone);
      } catch {
        targetPhone = phone.trim();
      }
      const o = fixtures.orders.find((x) => {
        if (x.businessId !== bId || x.orderNumber !== orderNumber) return false;
        if (!x.guestId) return false;
        const guest = fixtures.guests.find((g) => g.id === x.guestId);
        if (!guest || !guest.phone) return false;
        try {
          return normalizePhoneNumber(guest.phone) === targetPhone;
        } catch {
          return guest.phone === targetPhone;
        }
      });
      return o ? structuredClone(o) : null;
    },
    async list(bId, filter) {
      let res = fixtures.orders.filter((o) => o.businessId === bId);
      if (filter?.status) res = res.filter((o) => o.status === filter.status);
      if (filter?.guestId) res = res.filter((o) => o.guestId === filter.guestId);
      if (filter?.fromDate) res = res.filter((o) => o.requestedDate >= filter.fromDate!);
      if (filter?.toDate) res = res.filter((o) => o.requestedDate <= filter.toDate!);
      return structuredClone(res);
    },
    async create(bId, input) {
      const now = new Date().toISOString();
      const nextOrderNumber =
        input.orderNumber ??
        fixtures.orders.reduce((max, o) => Math.max(max, o.orderNumber ?? 0), 0) + 1;
      const o: Order = {
        id: input.id ?? crypto.randomUUID(),
        businessId: bId,
        orderNumber: nextOrderNumber,
        guestId: input.guestId,
        submittedName: input.submittedName ?? null,
        serviceType: input.serviceType,
        channel: input.channel,
        status: input.status,
        paid: input.paid,
        paymentPreference: input.paymentPreference,
        paymentMethod: input.paymentMethod ?? null,
        paidAt: input.paidAt ?? null,
        requestedDate: input.requestedDate,
        requestedTime: input.requestedTime ?? null,
        items: input.items.map((it) => ({ ...it, id: it.id ?? crypto.randomUUID() })),
        totalAmount: input.totalAmount,
        trackingToken: input.trackingToken ?? crypto.randomUUID().replace(/-/g, ""),
        cancellationReason: input.cancellationReason ?? null,
        notes: input.notes ?? null,
        deliveryAddress: input.deliveryAddress ?? null,
        statusHistory: input.statusHistory ?? [
          { status: input.status, timestamp: now, note: null },
        ],
        createdAt: now,
        updatedAt: now,
      };
      fixtures.orders.push(o);
      return structuredClone(o);
    },
    async update(bId, id, input) {
      const idx = findIndexOrThrow(
        fixtures.orders,
        (o) => o.businessId === bId && o.id === id,
        `Order ${id} not found`,
      );
      const updated = { ...fixtures.orders[idx], ...input, updatedAt: new Date().toISOString() };
      fixtures.orders[idx] = updated;
      return structuredClone(updated);
    },
  };

  const guests: GuestRepository = {
    async findById(bId, id) {
      const g = fixtures.guests.find((x) => x.businessId === bId && x.id === id);
      return g ? structuredClone(g) : null;
    },
    async findByPhone(bId, phone) {
      let target: string;
      try {
        target = normalizePhoneNumber(phone);
      } catch {
        target = phone.trim();
      }
      const match = fixtures.guests.find((g) => {
        if (g.businessId !== bId || !g.phone) return false;
        try {
          return normalizePhoneNumber(g.phone) === target;
        } catch {
          return g.phone === target;
        }
      });
      return match ? structuredClone(match) : null;
    },
    async list(bId) {
      return structuredClone(fixtures.guests.filter((g) => g.businessId === bId));
    },
    async create(bId, input) {
      const phone = input.phone ? normalizePhoneNumber(input.phone) : null;
      if (phone && !isGuestPhoneUnique(fixtures.guests, bId, phone)) {
        throw new Error("A guest with this phone number already exists");
      }
      const g: Guest = {
        id: input.id ?? crypto.randomUUID(),
        businessId: bId,
        name: normalizeGuestName(input.name),
        phone,
        email: input.email ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        createdAt: new Date().toISOString(),
      };
      fixtures.guests.push(g);
      return structuredClone(g);
    },
    async update(bId, id, input) {
      const idx = findIndexOrThrow(
        fixtures.guests,
        (g) => g.businessId === bId && g.id === id,
        `Guest ${id} not found`,
      );
      const existing = fixtures.guests[idx];
      const phone =
        input.phone !== undefined
          ? input.phone
            ? normalizePhoneNumber(input.phone)
            : null
          : existing.phone;
      if (phone && !isGuestPhoneUnique(fixtures.guests, bId, phone, id)) {
        throw new Error("A guest with this phone number already exists");
      }
      const name = input.name !== undefined ? normalizeGuestName(input.name) : existing.name;
      const updated = { ...existing, ...input, name, phone };
      fixtures.guests[idx] = updated;
      return structuredClone(updated);
    },
    async findOrCreate(bId, input) {
      return findOrCreateGuest(
        fixtures.guests,
        { businessId: bId, name: input.name, phone: input.phone, address: input.address },
        { allowRename: input.allowRename },
      );
    },
  };

  const expenses: ExpenseRepository = {
    async findById(bId, id) {
      const e = fixtures.expenses.find((x) => x.businessId === bId && x.id === id);
      return e ? structuredClone(e) : null;
    },
    async list(bId, filter) {
      let res = fixtures.expenses.filter((e) => e.businessId === bId);
      if (filter?.tag) res = res.filter((e) => e.tags.includes(filter.tag!));
      if (filter?.fromDate) res = res.filter((e) => e.date >= filter.fromDate!);
      if (filter?.toDate) res = res.filter((e) => e.date <= filter.toDate!);
      return structuredClone(res);
    },
    async create(bId, input) {
      const e: Expense = {
        id: input.id ?? crypto.randomUUID(),
        businessId: bId,
        amount: input.amount,
        date: input.date,
        description: input.description,
        tags: input.tags ? [...input.tags] : [],
        createdAt: new Date().toISOString(),
      };
      fixtures.expenses.push(e);
      return structuredClone(e);
    },
    async update(bId, id, input) {
      const idx = findIndexOrThrow(
        fixtures.expenses,
        (e) => e.businessId === bId && e.id === id,
        `Expense ${id} not found`,
      );
      const existing = fixtures.expenses[idx];
      const updated = { ...existing, ...input, tags: input.tags ? [...input.tags] : existing.tags };
      fixtures.expenses[idx] = updated;
      return structuredClone(updated);
    },
    async delete(bId, id) {
      const idx = findIndexOrThrow(
        fixtures.expenses,
        (e) => e.businessId === bId && e.id === id,
        `Expense ${id} not found`,
      );
      fixtures.expenses.splice(idx, 1);
    },
  };

  const business: BusinessRepository = {
    async findById(id) {
      return fixtures.business.id === id ? structuredClone(fixtures.business) : null;
    },
    async findBySlug(slug) {
      return fixtures.business.slug === slug ? structuredClone(fixtures.business) : null;
    },
    async create(input) {
      const now = new Date().toISOString();
      const b: Business = {
        id: input.id ?? crypto.randomUUID(),
        name: input.name,
        slug: input.slug,
        currency: input.currency ?? "EUR",
        description: input.description,
        phone: input.phone,
        email: input.email,
        whatsappNumber: input.whatsappNumber,
        address: input.address,
        logoUrl: input.logoUrl,
        createdAt: now,
        updatedAt: now,
      };
      fixtures.business = b;
      return structuredClone(b);
    },
    async update(id, input) {
      if (fixtures.business.id !== id) throw new Error(`Business ${id} not found`);
      fixtures.business = { ...fixtures.business, ...input, updatedAt: new Date().toISOString() };
      return structuredClone(fixtures.business);
    },
    async getSettings(bId) {
      return fixtures.settings.businessId === bId ? structuredClone(fixtures.settings) : null;
    },
    async updateSettings(bId, input) {
      if (fixtures.settings.businessId !== bId)
        throw new Error(`Settings for business ${bId} not found`);
      fixtures.settings = { ...fixtures.settings, ...input };
      return structuredClone(fixtures.settings);
    },
  };

  const members: MemberRepository = {
    async list(bId) {
      return structuredClone(fixtures.members.filter((m) => m.businessId === bId));
    },
    async findById(bId, id) {
      const m = fixtures.members.find((x) => x.businessId === bId && x.id === id);
      return m ? structuredClone(m) : null;
    },
    async findByUserId(bId, userId) {
      const m = fixtures.members.find((x) => x.businessId === bId && x.userId === userId);
      return m ? structuredClone(m) : null;
    },
    async add(bId, input) {
      const m: BusinessMember = {
        id: input.id ?? crypto.randomUUID(),
        businessId: bId,
        userId: input.userId,
        role: input.role,
        createdAt: new Date().toISOString(),
      };
      fixtures.members.push(m);
      return structuredClone(m);
    },
    async updateRole(bId, id, role) {
      const idx = findIndexOrThrow(
        fixtures.members,
        (m) => m.businessId === bId && m.id === id,
        `Member ${id} not found`,
      );
      fixtures.members[idx] = { ...fixtures.members[idx], role };
      return structuredClone(fixtures.members[idx]);
    },
    async remove(bId, id) {
      const idx = findIndexOrThrow(
        fixtures.members,
        (m) => m.businessId === bId && m.id === id,
        `Member ${id} not found`,
      );
      fixtures.members.splice(idx, 1);
    },
  };

  return { products, categories, orders, guests, expenses, business, members, reset };
}

let singletonInstance: MockRepositories | null = null;

export function getMockRepositories(): MockRepositories {
  if (!singletonInstance) singletonInstance = createMockRepositories();
  return singletonInstance;
}
