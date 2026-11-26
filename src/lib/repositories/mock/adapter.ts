import { isOwnerRole, OwnerRequiredError } from "@/domain/auth";
import type { Business, BusinessMember, BusinessMemberRole } from "@/domain/business";
import { validateOrderTransition } from "@/domain/order-lifecycle";
import { SLOT_ERROR_MESSAGES, SLOT_ERROR_REASONS } from "@/domain/checkout";
import { validateSlot, type OpeningSchedule } from "@/domain/opening-hours";
import { DEFAULT_TIMEZONE } from "@/domain/timezone";
import { sumOrderProductQuantities } from "@/domain/featured";
import type { Expense } from "@/domain/expense";
import {
  findOrCreateGuest,
  isGuestPhoneUnique,
  normalizeGuestName,
  normalizePhoneNumber,
} from "@/domain/guest";
import type { Guest } from "@/domain/guest";
import {
  publicDeliveryAddress,
  publicOrderSchema,
  publicPickupLocation,
  OrderRepoError,
  type CancelOrderResult,
  type Order,
  type OrderStatus,
  type PlacedOrderSummary,
} from "@/domain/order";
import type { PickupLocation } from "@/domain/pickup-location";
import { MAX_PICKUP_LOCATIONS, pickupScheduleFor } from "@/domain/pickup-location";
import type { Product, ProductCategory } from "@/domain/product";
import type {
  BusinessRepository,
  CategoryRepository,
  ExpenseRepository,
  GuestRepository,
  MemberRepository,
  OrderRepository,
  PickupLocationRepository,
  ProductRepository,
  Repositories,
} from "@/domain/repositories";
import {
  LOOKUP_RATE_LIMIT_BUSINESS_MAX_REQUESTS,
  LOOKUP_RATE_LIMIT_PHONE_MAX_REQUESTS,
  MAX_LINES_PER_ORDER,
  MAX_QUANTITY_PER_LINE,
  MAX_QUANTITY_PER_ORDER,
  RATE_LIMIT_BUSINESS_MAX_ORDERS,
  RATE_LIMIT_PHONE_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "@/domain/anti-abuse";
import { createDefaultFixtures, type MockFixtures } from "./fixtures";

export interface MockRepositories extends Repositories {
  reset(customFixtures?: MockFixtures): void;
  /** The same data seen by a member with another role (owner-only rules apply to it). */
  withRole(role: BusinessMemberRole): Repositories;
}

function findIndexOrThrow<T>(list: readonly T[], pred: (item: T) => boolean, msg: string): number {
  const idx = list.findIndex(pred);
  if (idx === -1) throw new Error(msg);
  return idx;
}

export interface MockRepositoryOptions {
  /** Role of the acting member; mirrors the database's owner-only rules. Defaults to owner. */
  readonly actingRole?: BusinessMemberRole;
}

/** Settings columns only an owner may change (mirrors enforce_owner_only_columns in the database). */
const OWNER_ONLY_SETTINGS_KEYS = [
  "revolutRevtag",
  "weroIdentifier",
  "paymentMethods",
  "paymentInstructionsEn",
  "paymentInstructionsFr",
] as const;

export function createMockRepositories(
  initialFixtures: MockFixtures = createDefaultFixtures(),
  options: MockRepositoryOptions = {},
): MockRepositories {
  let actingRole = options.actingRole ?? "owner";
  const requireOwner = (): void => {
    if (!isOwnerRole(actingRole)) throw new OwnerRequiredError();
  };
  // The role is only read synchronously at the start of the guarded methods, so switching it around
  // the call (not the awaited work) is enough.
  const runAs = <T>(role: BusinessMemberRole, call: () => Promise<T>): Promise<T> => {
    const previous = actingRole;
    actingRole = role;
    try {
      return call();
    } finally {
      actingRole = previous;
    }
  };
  let fixtures: MockFixtures = structuredClone(initialFixtures);
  // Mirrors the database-side guards of place_order / storefront_order_tracking_token so the
  // shared contract suites behave the same on mock and live: idempotent replay, and attempt
  // logs for the per-phone and per-business rate limits (successful storefront placements) and
  // the failed-lookup limit.
  let placements = new Map<
    string,
    { phone: string; payload: string; summary: PlacedOrderSummary }
  >();
  let orderAttempts: Array<{ businessId: string; phone: string; at: number }> = [];
  let lookupMisses: Array<{ key: string; at: number }> = [];
  const reset = (custom?: MockFixtures): void => {
    fixtures = custom ? structuredClone(custom) : createDefaultFixtures();
    placements = new Map();
    orderAttempts = [];
    lookupMisses = [];
  };
  const withinWindow = (at: number): boolean => Date.now() - at < RATE_LIMIT_WINDOW_MS;
  const rateLimitedError = (): OrderRepoError =>
    new OrderRepoError(
      "Too many order attempts. Please wait a few minutes before trying again.",
      "ANTI_ABUSE_REJECTION",
    );

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
        allergens: [...(input.allergens ?? [])],
        suggestAddOns: input.suggestAddOns ?? true,
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
        role: input.role ?? "regular",
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

  const sortedLocations = (bId: string): PickupLocation[] =>
    fixtures.pickupLocations
      .filter((l) => l.businessId === bId)
      .toSorted((a, b) => a.sortOrder - b.sortOrder);

  const pickupLocations: PickupLocationRepository = {
    async listByBusiness(bId, options) {
      const list = sortedLocations(bId);
      return structuredClone(options?.activeOnly ? list.filter((l) => l.isActive) : list);
    },
    async create(bId, input) {
      const existing = sortedLocations(bId);
      if (existing.length >= MAX_PICKUP_LOCATIONS) {
        throw new Error(`A business can have at most ${MAX_PICKUP_LOCATIONS} pickup locations`);
      }
      const now = new Date().toISOString();
      const location: PickupLocation = {
        id: input.id ?? crypto.randomUUID(),
        businessId: bId,
        name: input.name,
        description: input.description ?? null,
        address: input.address,
        postcode: input.postcode,
        feeCents: input.feeCents ?? 0,
        weeklyHours: input.weeklyHours ?? null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? (existing.at(-1)?.sortOrder ?? -1) + 1,
        createdAt: now,
        updatedAt: now,
      };
      fixtures.pickupLocations.push(location);
      return structuredClone(location);
    },
    async update(bId, id, input) {
      const idx = findIndexOrThrow(
        fixtures.pickupLocations,
        (l) => l.businessId === bId && l.id === id,
        `Pickup location ${id} not found`,
      );
      const definedPatch = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      const updated: PickupLocation = {
        ...fixtures.pickupLocations[idx],
        ...structuredClone(definedPatch),
        updatedAt: new Date().toISOString(),
      };
      fixtures.pickupLocations[idx] = updated;
      return structuredClone(updated);
    },
    async delete(bId, id) {
      const idx = findIndexOrThrow(
        fixtures.pickupLocations,
        (l) => l.businessId === bId && l.id === id,
        `Pickup location ${id} not found`,
      );
      fixtures.pickupLocations.splice(idx, 1);
      // Mirrors `on delete set null (pickup_location_id)`: clear the FK while keeping the snapshot.
      fixtures.orders = fixtures.orders.map((order) =>
        order.businessId === bId && order.pickupLocation?.id === id
          ? { ...order, pickupLocation: { ...order.pickupLocation, id: null } }
          : order,
      );
    },
    async reorder(bId, ids) {
      for (const id of ids) {
        findIndexOrThrow(
          fixtures.pickupLocations,
          (l) => l.businessId === bId && l.id === id,
          `Pickup location ${id} not found`,
        );
      }
      fixtures.pickupLocations = fixtures.pickupLocations.map((l) => {
        const position = ids.indexOf(l.id);
        return l.businessId === bId && position !== -1 ? { ...l, sortOrder: position } : l;
      });
      return structuredClone(sortedLocations(bId));
    },
  };

  const findOrderByTicketAndPhone = (bId: string, orderNumber: number, phone: string) => {
    let targetPhone: string;
    try {
      targetPhone = normalizePhoneNumber(phone);
    } catch {
      targetPhone = phone.trim();
    }
    return fixtures.orders.find((x) => {
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
  };

  const requireOrder = (bId: string, id: string): Order => {
    const order = fixtures.orders.find((o) => o.businessId === bId && o.id === id);
    if (!order) throw new OrderRepoError("Order not found", "ORDER_NOT_FOUND");
    return order;
  };

  // Mirrors apply_order_transition: transition table, reason and payment rules, stock restore on
  // cancellation and the history entry, all in one step.
  const applyTransition = (
    order: Order,
    nextStatus: OrderStatus,
    reason: string | null,
    requireReason: boolean,
  ): void => {
    const trimmed = reason?.trim() || null;
    const validation = validateOrderTransition({
      currentStatus: order.status,
      nextStatus,
      paid: order.paid,
      reason: requireReason ? trimmed : (trimmed ?? "n/a"),
    });
    if (!validation.ok) throw new OrderRepoError(validation.error, "INVALID_INPUT");

    const now = new Date().toISOString();
    if (nextStatus === "CANCELLED") {
      for (const item of order.items) {
        const prod = fixtures.products.find(
          (p) => p.businessId === order.businessId && p.id === item.productId,
        );
        if (prod) prod.stock += item.quantity;
      }
      order.cancellationReason = trimmed ?? order.cancellationReason ?? null;
    }
    order.status = nextStatus;
    order.statusHistory = [
      ...(order.statusHistory ?? []),
      { status: nextStatus, timestamp: now, note: trimmed },
    ];
    order.updatedAt = now;
  };

  const orders: OrderRepository = {
    async sumQuantitiesByProduct(bId, filter) {
      return sumOrderProductQuantities(
        fixtures.orders.filter((o) => o.businessId === bId),
        filter,
      );
    },
    async findById(bId, id) {
      const o = fixtures.orders.find((x) => x.businessId === bId && x.id === id);
      return o ? structuredClone(o) : null;
    },
    async findByTrackingToken(token) {
      const o = fixtures.orders.find((x) => x.trackingToken === token);
      if (!o) return null;
      return publicOrderSchema.parse({
        ...o,
        deliveryAddress: publicDeliveryAddress(o.serviceType, o.deliveryAddress),
        pickupLocation: publicPickupLocation(
          o.serviceType,
          o.pickupLocation?.name,
          o.pickupLocation?.address ?? fixtures.business.address,
        ),
      });
    },
    async place(bId, input): Promise<PlacedOrderSummary> {
      let phoneKey: string;
      try {
        phoneKey = normalizePhoneNumber(input.guestPhone);
      } catch {
        phoneKey = input.guestPhone.trim();
      }

      // Idempotent replay: the same (business, key) returns the original order untouched.
      const idempotencyId = input.idempotencyKey ? `${bId}:${input.idempotencyKey}` : null;
      // Same normalized payload as place_order's hash: merged items, service type, date, time,
      // payment preference and phone. A key replayed with a different cart is rejected.
      const payload = JSON.stringify({
        items: [
          ...input.items
            .reduce(
              (acc, it) => acc.set(it.productId, (acc.get(it.productId) ?? 0) + it.quantity),
              new Map<string, number>(),
            )
            .entries(),
        ].toSorted(([a], [b]) => a.localeCompare(b)),
        serviceType: input.serviceType,
        requestedDate: input.requestedDate,
        requestedTime: input.requestedTime ?? "",
        paymentPreference: input.paymentPreference ?? "on_handover",
        isAsap: input.isAsap ?? false,
        phone: phoneKey,
        // Only present when chosen, like place_order's payload.
        ...(input.pickupLocationId ? { pickupLocationId: input.pickupLocationId } : {}),
      });
      if (idempotencyId) {
        const prior = placements.get(idempotencyId);
        if (prior) {
          if (prior.phone !== phoneKey || prior.payload !== payload) {
            throw new OrderRepoError("Please check your order details.", "INVALID_INPUT");
          }
          return { ...prior.summary, replayed: true };
        }
      }

      const settings = fixtures.settings.businessId === bId ? fixtures.settings : null;
      if (settings?.acceptingOrders === false) {
        throw new OrderRepoError("This store is currently not accepting orders.", "STORE_CLOSED");
      }

      // Pickup location (all channels): exists, same business, active; pickup orders only.
      let location: PickupLocation | null = null;
      if (input.pickupLocationId) {
        if (input.serviceType !== "pickup") {
          throw new OrderRepoError(
            "The chosen pickup location is no longer available.",
            "PICKUP_LOCATION_INVALID",
          );
        }
        location =
          fixtures.pickupLocations.find(
            (l) => l.id === input.pickupLocationId && l.businessId === bId && l.isActive,
          ) ?? null;
        if (!location) {
          throw new OrderRepoError(
            "The chosen pickup location is no longer available.",
            "PICKUP_LOCATION_INVALID",
          );
        }
      }

      if (input.channel === "storefront") {
        // Pickup options: the shop (when enabled) plus the active relays; a lone relay is implied.
        if (input.serviceType === "pickup" && settings?.serviceTypes?.pickup !== false) {
          const relays = fixtures.pickupLocations.filter((l) => l.businessId === bId && l.isActive);
          const shopEnabled = settings?.shopPickupEnabled ?? true;
          if ((shopEnabled ? 1 : 0) + relays.length === 0) {
            throw new OrderRepoError("Pickup is currently not available.", "PICKUP_NOT_AVAILABLE");
          }
          if (!location && !shopEnabled) {
            if (relays.length !== 1) {
              throw new OrderRepoError(
                "Please choose a pickup location.",
                "PICKUP_LOCATION_REQUIRED",
              );
            }
            location = relays[0];
          }
        }

        // Same slot rules as place_order (window, ASAP only while open, open day/time); a relay
        // follows its own hours minus the business closures.
        if (settings) {
          const businessSchedule: OpeningSchedule = {
            weekly: settings.weeklyHours ?? null,
            exceptions: settings.hoursExceptions ?? [],
          };
          const slot = validateSlot(
            location ? pickupScheduleFor(businessSchedule, location.weeklyHours) : businessSchedule,
            settings.timezone ?? DEFAULT_TIMEZONE,
            new Date(),
            { date: input.requestedDate, time: input.requestedTime, isAsap: input.isAsap ?? false },
          );
          if (!slot.ok) {
            throw new OrderRepoError(
              SLOT_ERROR_MESSAGES[slot.reason],
              SLOT_ERROR_REASONS[slot.reason],
            );
          }
        }

        if (settings?.serviceTypes?.[input.serviceType] === false) {
          throw new OrderRepoError(
            "This service type is currently not available.",
            "SERVICE_TYPE_DISABLED",
          );
        }

        const pref = input.paymentPreference ?? "on_handover";
        const pm = settings?.paymentMethods;
        if (pm) {
          const allowed =
            pref === "on_handover"
              ? (pm.cash ?? true) || (pm.card ?? false)
              : pref === "revolut"
                ? (pm.revolut ?? true)
                : (pm.wero ?? true);
          if (!allowed) {
            throw new OrderRepoError("Please check your order details.", "INVALID_INPUT");
          }
        }

        // Same caps as place_order (MAX_* in src/domain/anti-abuse.ts), on per-product totals.
        const perProduct = new Map<string, number>();
        for (const item of input.items) {
          perProduct.set(item.productId, (perProduct.get(item.productId) ?? 0) + item.quantity);
        }
        const antiAbuse = (message: string) => new OrderRepoError(message, "ANTI_ABUSE_REJECTION");
        if (input.items.length > MAX_LINES_PER_ORDER) {
          throw antiAbuse("Your order exceeds the maximum order size.");
        }
        if ([...perProduct.values()].some((q) => q > MAX_QUANTITY_PER_LINE)) {
          throw antiAbuse("Maximum quantity exceeded for an item in your order.");
        }
        if ([...perProduct.values()].reduce((a, b) => a + b, 0) > MAX_QUANTITY_PER_ORDER) {
          throw antiAbuse("Your order exceeds the maximum order size.");
        }

        orderAttempts = orderAttempts.filter((a) => withinWindow(a.at));
        const forPhone = orderAttempts.filter(
          (a) => a.businessId === bId && a.phone === phoneKey,
        ).length;
        const forBusiness = orderAttempts.filter((a) => a.businessId === bId).length;
        if (
          forPhone >= RATE_LIMIT_PHONE_MAX_REQUESTS ||
          forBusiness >= RATE_LIMIT_BUSINESS_MAX_ORDERS
        ) {
          throw rateLimitedError();
        }
      }

      // 1. Stock check & availability
      for (const item of input.items) {
        const product = fixtures.products.find(
          (p) => p.businessId === bId && p.id === item.productId,
        );
        if (!product || (input.channel === "storefront" && !product.visible)) {
          throw new OrderRepoError("This product is unavailable.", "STOCK_ERROR");
        }
        if (product.stock < item.quantity) {
          throw new OrderRepoError(`Insufficient stock for product ${product.name}`, "STOCK_ERROR");
        }
      }

      // 2. Totals and minimum order amount (validated before anything is mutated)
      let subtotal = 0;
      const orderItems = input.items.map((it) => {
        const prod = fixtures.products.find((p) => p.businessId === bId && p.id === it.productId)!;
        const lineTotal = prod.price * it.quantity;
        subtotal += lineTotal;
        return {
          id: crypto.randomUUID(),
          productId: prod.id,
          productName: prod.name,
          quantity: it.quantity,
          unitPrice: prod.price,
          totalPrice: lineTotal,
        };
      });

      const deliveryFee = input.serviceType === "delivery" ? (settings?.deliveryFee ?? 0) : 0;
      const minOrder = settings?.minOrderAmount ?? 0;
      if (input.channel === "storefront" && minOrder > 0 && subtotal < minOrder) {
        throw new OrderRepoError(
          `Minimum order amount of ${(minOrder / 100).toFixed(2)} € not met.`,
          "MINIMUM_ORDER_UNMET",
        );
      }
      const pickupFee = location?.feeCents ?? 0;
      const totalAmount = subtotal + deliveryFee + pickupFee;

      // 3. Decrement stock
      for (const item of input.items) {
        const product = fixtures.products.find(
          (p) => p.businessId === bId && p.id === item.productId,
        )!;
        product.stock -= item.quantity;
      }

      // 4. Blind guest resolution
      const guestRes = findOrCreateGuest(
        fixtures.guests,
        {
          businessId: bId,
          name: input.guestName,
          phone: input.guestPhone,
          address: input.deliveryAddress,
        },
        { allowRename: input.allowRename },
      );

      // 5. Allocate order number
      const nextOrderNumber =
        fixtures.orders
          .filter((o) => o.businessId === bId)
          .reduce((max, o) => Math.max(max, o.orderNumber ?? 0), 0) + 1;

      const now = new Date().toISOString();
      const o: Order = {
        id: crypto.randomUUID(),
        businessId: bId,
        orderNumber: nextOrderNumber,
        guestId: guestRes.guestId,
        submittedName: guestRes.nameMismatch ? input.guestName : null,
        serviceType: input.serviceType,
        channel: input.channel,
        status: "NEW",
        paid: "unpaid",
        paymentPreference: input.paymentPreference ?? "on_handover",
        paymentMethod: null,
        paidAt: null,
        refundedAt: null,
        requestedDate: input.requestedDate,
        requestedTime: input.requestedTime ?? null,
        items: orderItems,
        totalAmount,
        trackingToken: crypto.randomUUID().replace(/-/g, ""),
        cancellationReason: null,
        notes: input.notes ?? null,
        deliveryAddress: input.deliveryAddress ?? null,
        pickupLocation: location
          ? {
              id: location.id,
              name: location.name,
              address: `${location.address}, ${location.postcode}`,
            }
          : null,
        pickupFeeCents: pickupFee,
        statusHistory: [
          {
            status: "NEW",
            timestamp: now,
            note:
              input.channel === "storefront"
                ? "Order placed via online storefront"
                : `Order placed via ${input.channel}`,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      fixtures.orders.push(o);

      const summary: PlacedOrderSummary = {
        orderId: o.id,
        orderNumber: o.orderNumber!,
        trackingToken: o.trackingToken!,
        submittedName: o.submittedName,
        totalAmount: o.totalAmount,
        replayed: false,
      };
      if (idempotencyId) placements.set(idempotencyId, { phone: phoneKey, payload, summary });
      if (input.channel === "storefront") {
        orderAttempts.push({ businessId: bId, phone: phoneKey, at: Date.now() });
      }
      return { ...summary };
    },

    async cancel(bId: string, orderId: string, reason?: string | null): Promise<CancelOrderResult> {
      const order = requireOrder(bId, orderId);
      // Same contract as cancel_order: no reason required, no expected status.
      applyTransition(order, "CANCELLED", reason ?? null, false);
      return {
        orderId: order.id,
        status: "CANCELLED",
        cancellationReason: order.cancellationReason,
      };
    },
    async transition(bId, orderId, input) {
      const order = requireOrder(bId, orderId);
      if (order.status !== input.expectedStatus) {
        throw new OrderRepoError(
          `ORDER_STATE_CONFLICT: expected status ${input.expectedStatus} but the order is ${order.status}`,
          "ORDER_STATE_CONFLICT",
        );
      }
      applyTransition(order, input.nextStatus, input.reason ?? null, true);
      return structuredClone(order);
    },
    async recordPayment(bId, orderId, input) {
      const order = requireOrder(bId, orderId);
      if (order.status === "CANCELLED") {
        throw new OrderRepoError(
          "Payment cannot be recorded for a cancelled order.",
          "INVALID_INPUT",
        );
      }
      if (order.paid === "refunded") {
        throw new OrderRepoError(
          "Payment cannot be recorded for a refunded order.",
          "INVALID_INPUT",
        );
      }
      if (order.paid === "paid") {
        throw new OrderRepoError("This order is already paid.", "INVALID_INPUT");
      }
      const now = new Date().toISOString();
      if (input.markCompleted) {
        if (order.status !== "READY") {
          throw new OrderRepoError(
            `ORDER_STATE_CONFLICT: order must be READY to mark paid and complete (it is ${order.status})`,
            "ORDER_STATE_CONFLICT",
          );
        }
        order.status = "COMPLETED";
        order.statusHistory = [
          ...(order.statusHistory ?? []),
          {
            status: "COMPLETED",
            timestamp: now,
            note: `Paid via ${input.paymentMethod} and completed`,
          },
        ];
      }
      order.paid = "paid";
      order.paymentMethod = input.paymentMethod;
      order.paidAt = now;
      order.updatedAt = now;
      return structuredClone(order);
    },
    async markUnpaid(bId, orderId) {
      const order = requireOrder(bId, orderId);
      if (order.status === "COMPLETED") {
        throw new OrderRepoError("Cannot mark a completed order as unpaid.", "INVALID_INPUT");
      }
      if (order.paid === "refunded") {
        throw new OrderRepoError("Cannot mark a refunded order as unpaid.", "INVALID_INPUT");
      }
      if (order.paid === "unpaid") {
        throw new OrderRepoError("Order is already marked as unpaid.", "INVALID_INPUT");
      }
      const now = new Date().toISOString();
      order.paid = "unpaid";
      order.paymentMethod = null;
      order.paidAt = null;
      order.statusHistory = [
        ...(order.statusHistory ?? []),
        { status: order.status, timestamp: now, note: "Payment marked as unpaid (undone)" },
      ];
      order.updatedAt = now;
      return structuredClone(order);
    },
    async recordRefund(bId, orderId, reason) {
      requireOwner();
      const order = requireOrder(bId, orderId);
      if (order.paid === "refunded") {
        throw new OrderRepoError("Order is already marked as refunded.", "INVALID_INPUT");
      }
      if (order.paid === "unpaid") {
        throw new OrderRepoError("Cannot refund an unpaid order.", "INVALID_INPUT");
      }
      const now = new Date().toISOString();
      const trimmed = reason?.trim();
      order.paid = "refunded";
      order.refundedAt = now;
      order.statusHistory = [
        ...(order.statusHistory ?? []),
        {
          status: order.status,
          timestamp: now,
          note: trimmed ? `Refund recorded: ${trimmed}` : "Refund recorded",
        },
      ];
      order.updatedAt = now;
      return structuredClone(order);
    },
    async replaceItems(bId, orderId, items) {
      const order = requireOrder(bId, orderId);
      if (
        order.status === "COMPLETED" ||
        order.status === "CANCELLED" ||
        order.paid === "paid" ||
        order.paid === "refunded"
      ) {
        throw new OrderRepoError(
          `ORDER_STATE_CONFLICT: order items cannot be changed once the order is ${order.status} (paid: ${order.paid})`,
          "ORDER_STATE_CONFLICT",
        );
      }
      if (items.length === 0) {
        throw new OrderRepoError("An order needs at least one item.", "INVALID_INPUT");
      }
      const wanted = new Map<string, number>();
      for (const it of items) {
        wanted.set(it.productId, (wanted.get(it.productId) ?? 0) + it.quantity);
      }
      const current = new Map<string, Order["items"][number]>();
      for (const it of order.items) current.set(it.productId, it);

      // Validate everything before mutating: unknown product, then stock for the delta.
      for (const [productId, quantity] of wanted) {
        const product = fixtures.products.find((p) => p.businessId === bId && p.id === productId);
        if (!product) throw new OrderRepoError("Product not found.", "PRODUCT_NOT_FOUND");
        const delta = quantity - (current.get(productId)?.quantity ?? 0);
        if (delta > product.stock) {
          throw new OrderRepoError(`Insufficient stock for product ${product.name}`, "STOCK_ERROR");
        }
      }

      for (const productId of new Set([...wanted.keys(), ...current.keys()])) {
        const product = fixtures.products.find((p) => p.businessId === bId && p.id === productId);
        if (!product) continue;
        product.stock -= (wanted.get(productId) ?? 0) - (current.get(productId)?.quantity ?? 0);
      }

      let subtotal = 0;
      const nextItems = [...wanted].map(([productId, quantity]) => {
        const existing = current.get(productId);
        const product = fixtures.products.find((p) => p.id === productId)!;
        const unitPrice = existing?.unitPrice ?? product.price;
        const totalPrice = unitPrice * quantity;
        subtotal += totalPrice;
        return {
          id: crypto.randomUUID(),
          productId,
          productName: existing?.productName ?? product.name,
          quantity,
          unitPrice,
          totalPrice,
        };
      });
      const deliveryFee =
        order.serviceType === "delivery" ? Math.max(0, fixtures.settings.deliveryFee ?? 0) : 0;
      const pickupFee = order.serviceType === "pickup" ? Math.max(0, order.pickupFeeCents ?? 0) : 0;
      order.items = nextItems;
      order.totalAmount = subtotal + deliveryFee + pickupFee;
      order.updatedAt = new Date().toISOString();
      return structuredClone(order);
    },
    async findTrackingTokenByTicketAndPhone(bId, orderNumber, phone) {
      // Same contract as storefront_order_tracking_token: failed lookups are counted per
      // (business, phone) and a limited phone is refused whether or not the order exists.
      const key = `${bId}:${phone.trim()}`;
      lookupMisses = lookupMisses.filter((m) => withinWindow(m.at));
      if (
        lookupMisses.filter((m) => m.key === key).length >= LOOKUP_RATE_LIMIT_PHONE_MAX_REQUESTS ||
        lookupMisses.filter((m) => m.key.startsWith(`${bId}:`)).length >=
          LOOKUP_RATE_LIMIT_BUSINESS_MAX_REQUESTS
      ) {
        throw new OrderRepoError("Too many attempts. Please try again later.", "RATE_LIMITED");
      }
      const token = findOrderByTicketAndPhone(bId, orderNumber, phone)?.trackingToken ?? null;
      if (token === null) lookupMisses.push({ key, at: Date.now() });
      return token;
    },
    async list(bId, filter) {
      let res = fixtures.orders.filter((o) => o.businessId === bId);
      if (filter?.status) res = res.filter((o) => o.status === filter.status);
      if (filter?.guestId) res = res.filter((o) => o.guestId === filter.guestId);
      if (filter?.fromDate) res = res.filter((o) => o.requestedDate >= filter.fromDate!);
      if (filter?.toDate) res = res.filter((o) => o.requestedDate <= filter.toDate!);
      return structuredClone(res);
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
      requireOwner();
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
        instagramUrl: input.instagramUrl,
        facebookUrl: input.facebookUrl,
        tiktokUrl: input.tiktokUrl,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        logoUrl: input.logoUrl,
        createdAt: now,
        updatedAt: now,
      };
      fixtures.business = b;
      return structuredClone(b);
    },
    async update(id, input) {
      if (fixtures.business.id !== id) throw new Error(`Business ${id} not found`);
      if (input.slug !== undefined && input.slug !== fixtures.business.slug) requireOwner();
      fixtures.business = { ...fixtures.business, ...input, updatedAt: new Date().toISOString() };
      return structuredClone(fixtures.business);
    },
    async getSettings(bId) {
      return fixtures.settings.businessId === bId ? structuredClone(fixtures.settings) : null;
    },
    async updateSettings(bId, input) {
      if (fixtures.settings.businessId !== bId)
        throw new Error(`Settings for business ${bId} not found`);
      const touchesOwnerOnly = OWNER_ONLY_SETTINGS_KEYS.some(
        (key) =>
          input[key] !== undefined &&
          JSON.stringify(input[key]) !== JSON.stringify(fixtures.settings[key]),
      );
      if (touchesOwnerOnly) requireOwner();
      const definedPatch = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ) as Partial<typeof fixtures.settings>;
      fixtures.settings = { ...fixtures.settings, ...structuredClone(definedPatch) };
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
    async findMembershipForUser(userId) {
      // Single-business-per-user assumption: FoodBiz currently models exactly one active business per manager.
      // Deterministically sort by created_at asc, id asc to select the earliest created membership.
      const userMemberships = fixtures.members
        .filter((m) => m.userId === userId)
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

      if (userMemberships.length === 0) {
        return null;
      }

      const oldest = userMemberships[0];
      const biz = fixtures.business.id === oldest.businessId ? fixtures.business : null;
      if (!biz) {
        return null;
      }

      return {
        member: {
          id: oldest.id,
          businessId: oldest.businessId,
          role: oldest.role,
        },
        business: {
          id: biz.id,
          name: biz.name,
          slug: biz.slug,
          currency: biz.currency,
        },
      };
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

  const withRole = (role: BusinessMemberRole): Repositories => ({
    products,
    categories,
    orders: {
      ...orders,
      recordRefund: (bId, id, reason) => runAs(role, () => orders.recordRefund(bId, id, reason)),
    },
    guests,
    members,
    pickupLocations,
    expenses: { ...expenses, delete: (bId, id) => runAs(role, () => expenses.delete(bId, id)) },
    business: {
      ...business,
      update: (id, input) => runAs(role, () => business.update(id, input)),
      updateSettings: (bId, input) => runAs(role, () => business.updateSettings(bId, input)),
    },
  });

  return {
    products,
    categories,
    orders,
    guests,
    expenses,
    business,
    members,
    pickupLocations,
    reset,
    withRole,
  };
}

// Kept on globalThis: Next bundles route handlers and pages separately, so a module-level
// variable would give each its own copy of the "shared" in-memory data.
const SINGLETON_KEY = Symbol.for("foodbiz.mockRepositories");
type MockGlobal = { [SINGLETON_KEY]?: MockRepositories };

export function getMockRepositories(): MockRepositories {
  const holder = globalThis as MockGlobal;
  holder[SINGLETON_KEY] ??= createMockRepositories();
  return holder[SINGLETON_KEY];
}

/** Puts the shared mock data (and its rate-limit logs) back to the seed state. */
export function resetMockData(): void {
  getMockRepositories().reset();
}
