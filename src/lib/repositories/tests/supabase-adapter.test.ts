// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Order, OrderStatus } from "@/domain/order";
import { validateOrderTransition } from "@/domain/order-lifecycle";
import { validateSlot, type HoursException, type WeeklyHours } from "@/domain/opening-hours";
import { DEFAULT_TIMEZONE, getZonedDay } from "@/domain/timezone";
import type { Repositories } from "@/domain/repositories";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createDefaultFixtures, DEMO_BUSINESS_ID, type MockFixtures } from "../mock/fixtures";
import { createSupabaseRepositories } from "../supabase";
import { PUBLIC_PRODUCT_COLUMNS } from "../supabase/adapter";
import {
  LOOKUP_RATE_LIMIT_PHONE_MAX_REQUESTS,
  MAX_LINES_PER_ORDER,
  MAX_QUANTITY_PER_LINE,
  MAX_QUANTITY_PER_ORDER,
  RATE_LIMIT_BUSINESS_MAX_ORDERS,
  RATE_LIMIT_PHONE_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "@/domain/anti-abuse";
import { describeRepositoryContracts } from "./contracts";

function createFakeSupabaseClient(
  initialFixtures: MockFixtures = createDefaultFixtures(),
): SupabaseClient<Database> {
  const fixtures = structuredClone(initialFixtures);
  let lookupMisses: Array<{ key: string; at: number }> = [];
  const tables = {
    businesses: [
      {
        id: fixtures.business.id,
        name: fixtures.business.name,
        slug: fixtures.business.slug,
        currency: fixtures.business.currency,
        description: fixtures.business.description ?? null,
        phone: fixtures.business.phone ?? null,
        email: fixtures.business.email ?? null,
        whatsapp_number: fixtures.business.whatsappNumber ?? null,
        instagram_url: fixtures.business.instagramUrl ?? null,
        facebook_url: fixtures.business.facebookUrl ?? null,
        tiktok_url: fixtures.business.tiktokUrl ?? null,
        address: fixtures.business.address ?? null,
        latitude: fixtures.business.latitude ?? null,
        longitude: fixtures.business.longitude ?? null,
        logo_url: fixtures.business.logoUrl ?? null,
        created_at: fixtures.business.createdAt,
        updated_at: fixtures.business.updatedAt,
      },
      {
        id: "99999999-9999-4999-8999-999999999999",
        name: "Secondary Test Shop",
        slug: "secondary-test-shop",
        currency: "EUR",
        description: null,
        phone: null,
        email: null,
        whatsapp_number: null,
        instagram_url: null,
        facebook_url: null,
        tiktok_url: null,
        address: null,
        latitude: null,
        longitude: null,
        logo_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    business_settings: [
      {
        id: fixtures.settings.id ?? crypto.randomUUID(),
        business_id: fixtures.settings.businessId,
        currency: fixtures.settings.currency,
        date_format: fixtures.settings.dateFormat,
        low_stock_threshold: fixtures.settings.lowStockThreshold,
        tax_percentage: fixtures.settings.taxPercentage,
        notifications: fixtures.settings.notifications,
        accepting_orders: fixtures.settings.acceptingOrders,
        service_types: structuredClone(fixtures.settings.serviceTypes) as Json,
        opening_hours: fixtures.settings.openingHours,
        weekly_hours: structuredClone(fixtures.settings.weeklyHours ?? null) as Json | null,
        hours_exceptions: structuredClone(fixtures.settings.hoursExceptions ?? []) as Json,
        shop_pickup_enabled: fixtures.settings.shopPickupEnabled ?? true,
        order_timing_asap: fixtures.settings.orderTimingAsap,
        order_timing_scheduled: fixtures.settings.orderTimingScheduled,
        order_timing_time_optional: fixtures.settings.orderTimingTimeOptional,
        delivery_fee: fixtures.settings.deliveryFee,
        min_order_amount: fixtures.settings.minOrderAmount,
        lead_time_value: fixtures.settings.leadTimeValue,
        lead_time_unit: fixtures.settings.leadTimeUnit,
        timezone: fixtures.settings.timezone,
        revolut_revtag: fixtures.settings.revolutRevtag,
        wero_identifier: fixtures.settings.weroIdentifier,
        payment_methods: structuredClone(fixtures.settings.paymentMethods) as Json,
        payment_instructions_en: fixtures.settings.paymentInstructionsEn,
        payment_instructions_fr: fixtures.settings.paymentInstructionsFr,
        in_app_alerts: fixtures.settings.inAppAlerts,
        sound_alerts: fixtures.settings.soundAlerts,
        updated_at: new Date().toISOString(),
      },
    ],
    business_members: fixtures.members.map((m) => ({
      id: m.id,
      business_id: m.businessId,
      user_id: m.userId,
      role: m.role,
      created_at: m.createdAt,
    })),
    product_categories: fixtures.categories.map((c) => ({
      id: c.id,
      business_id: c.businessId,
      name: c.name,
      sort_order: c.sortOrder,
      role: c.role,
      created_at: c.createdAt,
    })),
    products: fixtures.products.map((p) => ({
      id: p.id,
      business_id: p.businessId,
      category_id: p.categoryId,
      name: p.name,
      description: p.description,
      price: p.price,
      unit_cost: p.unitCost,
      stock: p.stock,
      visible: p.visible,
      allergens: [...p.allergens],
      suggest_add_ons: p.suggestAddOns,
      image_url: p.imageUrl,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    })),
    guests: fixtures.guests.map((g) => ({
      id: g.id,
      business_id: g.businessId,
      name: g.name,
      phone: g.phone,
      email: g.email,
      address: g.address,
      notes: g.notes,
      created_at: g.createdAt,
    })),
    orders: fixtures.orders.map((o) => ({
      id: o.id,
      business_id: o.businessId,
      order_number: o.orderNumber ?? 0,
      guest_id: o.guestId,
      submitted_name: o.submittedName,
      service_type: o.serviceType,
      channel: o.channel,
      status: o.status,
      paid: o.paid,
      payment_preference: o.paymentPreference,
      payment_method: o.paymentMethod,
      paid_at: o.paidAt,
      refunded_at: o.refundedAt,
      requested_date: o.requestedDate,
      requested_time: o.requestedTime,
      total_amount: o.totalAmount,
      tracking_token: o.trackingToken ?? crypto.randomUUID().replace(/-/g, ""),
      cancellation_reason: o.cancellationReason,
      notes: o.notes,
      delivery_address: o.deliveryAddress,
      pickup_location_id: o.pickupLocation?.id ?? null,
      pickup_location_name: o.pickupLocation?.name ?? null,
      pickup_location_address: o.pickupLocation?.address ?? null,
      pickup_fee_cents: o.pickupFeeCents ?? 0,
      status_history: structuredClone(o.statusHistory ?? []) as Json,
      created_at: o.createdAt,
      updated_at: o.updatedAt,
    })),
    order_items: fixtures.orders.flatMap((o) =>
      o.items.map((it) => ({
        id: it.id ?? crypto.randomUUID(),
        order_id: o.id,
        business_id: o.businessId,
        product_id: it.productId,
        product_name: it.productName,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        total_price: it.totalPrice,
        created_at: o.createdAt,
      })),
    ),
    pickup_locations: fixtures.pickupLocations.map((l) => ({
      id: l.id,
      business_id: l.businessId,
      name: l.name,
      description: l.description,
      address: l.address,
      postcode: l.postcode,
      fee_cents: l.feeCents,
      weekly_hours: structuredClone(l.weeklyHours) as Json | null,
      is_active: l.isActive,
      sort_order: l.sortOrder,
      created_at: l.createdAt,
      updated_at: l.updatedAt,
    })),
    expenses: fixtures.expenses.map((e) => ({
      id: e.id,
      business_id: e.businessId,
      amount: e.amount,
      date: e.date,
      description: e.description,
      tags: [...e.tags],
      created_at: e.createdAt,
    })),
  };

  function queryBuilder(table: keyof typeof tables) {
    let mode: "select" | "insert" | "update" | "delete" = "select";
    let selectCols: string | undefined;
    let dataToInsert: unknown = null;
    let dataToUpdate: Record<string, unknown> | null = null;
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    const orderConfigs: Array<{ col: string; ascending: boolean }> = [];
    let limitCount: number | undefined;

    const builder = {
      select(cols?: string) {
        selectCols = cols;
        return builder;
      },
      insert(data: unknown) {
        mode = "insert";
        dataToInsert = data;
        return builder;
      },
      update(data: Record<string, unknown>) {
        mode = "update";
        dataToUpdate = data;
        return builder;
      },
      delete() {
        mode = "delete";
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return builder;
      },
      neq(col: string, val: unknown) {
        filters.push((row) => row[col] !== val);
        return builder;
      },
      gte(col: string, val: unknown) {
        filters.push((row) => String(row[col]) >= String(val));
        return builder;
      },
      lte(col: string, val: unknown) {
        filters.push((row) => String(row[col]) <= String(val));
        return builder;
      },
      contains(col: string, val: unknown[]) {
        filters.push((row) => {
          const arr = row[col];
          return Array.isArray(arr) && val.every((v) => arr.includes(v));
        });
        return builder;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderConfigs.push({ col, ascending: opts?.ascending ?? true });
        return builder;
      },
      limit(n: number) {
        limitCount = n;
        return builder;
      },
      async single() {
        const res = await execute();
        if (res.error) return res;
        const row = Array.isArray(res.data) ? res.data[0] : res.data;
        if (!row) {
          return { data: null, error: { message: "Row not found", code: "PGRST116" } };
        }
        return { data: row, error: null };
      },
      async maybeSingle() {
        const res = await execute();
        if (res.error) return res;
        const row = Array.isArray(res.data) ? res.data[0] : res.data;
        return { data: row ?? null, error: null };
      },
      then(
        onfulfilled?: (value: { data: unknown; error: unknown }) => unknown,
        onrejected?: (reason: unknown) => unknown,
      ) {
        return execute().then(onfulfilled, onrejected);
      },
    };

    async function execute(): Promise<{ data: unknown; error: unknown }> {
      const list = tables[table] as Record<string, unknown>[];

      if (mode === "insert") {
        const items = (Array.isArray(dataToInsert) ? dataToInsert : [dataToInsert]) as Record<
          string,
          unknown
        >[];
        const inserted = items.map((item) => {
          const row: Record<string, unknown> = { ...item };
          if (!row.id) row.id = crypto.randomUUID();
          if (!row.created_at) row.created_at = new Date().toISOString();

          if (table === "guests" && row.phone) {
            const dup = list.find(
              (g) => g.business_id === row.business_id && g.phone === row.phone && g.id !== row.id,
            );
            if (dup) {
              throw { code: "23505", message: "duplicate key value violates unique constraint" };
            }
          }

          if (table === "pickup_locations") {
            // Table defaults and the 23514 limit trigger of migration 035.
            if (list.filter((l) => l.business_id === row.business_id).length >= 20) {
              throw { code: "23514", message: "PICKUP_LOCATIONS_LIMIT" };
            }
            row.updated_at ??= row.created_at;
          }

          if (table === "businesses") {
            if (!row.currency) row.currency = "EUR";
            if (!row.created_at) row.created_at = new Date().toISOString();
            if (!row.updated_at) row.updated_at = new Date().toISOString();
          }

          if (table === "business_settings") {
            const defaults = {
              id: crypto.randomUUID(),
              currency: "EUR",
              date_format: "DD/MM/YYYY",
              low_stock_threshold: 5,
              tax_percentage: 0,
              notifications: true,
              accepting_orders: true,
              service_types: { pickup: true, delivery: true, dineIn: true },
              opening_hours: "",
              weekly_hours: null,
              hours_exceptions: [],
              shop_pickup_enabled: true,
              order_timing_asap: true,
              order_timing_scheduled: true,
              order_timing_time_optional: true,
              delivery_fee: 0,
              min_order_amount: 0,
              lead_time_value: 1,
              lead_time_unit: "business_days",
              timezone: "Europe/Paris",
              revolut_revtag: "",
              wero_identifier: "",
              payment_methods: { cash: true, card: false, revolut: true, wero: true },
              payment_instructions_en: "",
              payment_instructions_fr: "",
              in_app_alerts: true,
              sound_alerts: true,
              updated_at: new Date().toISOString(),
            };
            Object.assign(row, { ...defaults, ...row });
          }

          list.push(row);
          return structuredClone(row);
        });

        return { data: Array.isArray(dataToInsert) ? inserted : inserted[0], error: null };
      }

      if (mode === "delete") {
        const matched: Record<string, unknown>[] = [];
        for (let i = list.length - 1; i >= 0; i--) {
          if (filters.every((f) => f(list[i]))) {
            matched.push(list[i]);
            list.splice(i, 1);
          }
        }
        return { data: matched.length === 1 ? matched[0] : (matched[0] ?? null), error: null };
      }

      if (mode === "update") {
        const matched: Record<string, unknown>[] = [];
        for (const row of list) {
          if (filters.every((f) => f(row))) {
            if (table === "guests" && dataToUpdate?.phone) {
              const dup = list.find(
                (g) =>
                  g.business_id === row.business_id &&
                  g.phone === dataToUpdate?.phone &&
                  g.id !== row.id,
              );
              if (dup) {
                return {
                  data: null,
                  error: {
                    code: "23505",
                    message: "duplicate key value violates unique constraint",
                  },
                };
              }
            }

            Object.assign(row, dataToUpdate);
            if (
              table === "products" ||
              table === "businesses" ||
              table === "orders" ||
              table === "business_settings" ||
              table === "pickup_locations"
            ) {
              row.updated_at = new Date().toISOString();
            }
            matched.push(structuredClone(row));
          }
        }
        return { data: matched.length === 1 ? matched[0] : (matched[0] ?? null), error: null };
      }

      // mode === "select"
      let result = list.filter((row) => filters.every((f) => f(row)));
      if (orderConfigs.length > 0) {
        result = result.toSorted((a, b) => {
          for (const { col, ascending } of orderConfigs) {
            const valA = a[col] as string | number;
            const valB = b[col] as string | number;
            if (valA < valB) return ascending ? -1 : 1;
            if (valA > valB) return ascending ? 1 : -1;
          }
          return 0;
        });
      }
      if (limitCount !== undefined) {
        result = result.slice(0, limitCount);
      }
      let finalResult = structuredClone(result);
      if (table === "business_members" && selectCols && selectCols.includes("businesses")) {
        finalResult = finalResult.map((mem) => {
          const biz = tables.businesses.find((b) => b.id === mem.business_id);
          return {
            ...mem,
            businesses: biz
              ? {
                  id: biz.id,
                  name: biz.name,
                  slug: biz.slug,
                  currency: biz.currency,
                }
              : null,
          };
        });
      }
      if (table === "orders" && selectCols && selectCols.includes("order_items(*)")) {
        finalResult = finalResult.map((ord) => {
          const items = tables.order_items.filter((it) => it.order_id === ord.id);
          return {
            ...ord,
            order_items: structuredClone(items),
          };
        });
      }
      if (
        table === "business_settings" &&
        selectCols &&
        !selectCols.includes("low_stock_threshold")
      ) {
        const allowedCols = selectCols.split(",").map((c: string) => c.trim());
        finalResult = finalResult.map((row) => {
          const rawRow = row as Record<string, unknown>;
          const filtered: Record<string, unknown> = {};
          for (const col of allowedCols) {
            if (col in rawRow) filtered[col] = rawRow[col];
          }
          return filtered as unknown as (typeof finalResult)[number];
        });
      }
      return { data: finalResult, error: null };
    }

    return builder;
  }

  const fakeClient = {
    from(tableName: keyof typeof tables) {
      return queryBuilder(tableName);
    },
    async rpc(fnName: string, args: Record<string, unknown>) {
      if (fnName === "reorder_pickup_locations") {
        // Mirrors the SQL function: ids must be exactly the business's locations.
        const ids = args.p_ids as string[];
        const own = tables.pickup_locations.filter((l) => l.business_id === args.p_business_id);
        if (
          new Set(ids).size !== ids.length ||
          own.length !== ids.length ||
          !ids.every((id) => own.some((l) => l.id === id))
        ) {
          return { data: null, error: { code: "22023", message: "PICKUP_REORDER_MISMATCH" } };
        }
        for (const [position, id] of ids.entries()) {
          const row = own.find((l) => l.id === id);
          if (row) row.sort_order = position;
        }
        return { data: null, error: null };
      }
      if (fnName === "get_order_by_tracking_token") {
        const order = tables.orders.find((o) => o.tracking_token === args.p_tracking_token);
        if (!order) return { data: null, error: null };
        const items = tables.order_items.filter((it) => it.order_id === order.id);
        return {
          data: {
            order: {
              ...structuredClone(order),
              delivery_address:
                order.service_type === "delivery" ? (order.delivery_address ?? null) : null,
              pickup_location_name:
                order.service_type === "pickup" ? order.pickup_location_name : null,
              pickup_location_address:
                order.service_type === "pickup"
                  ? (order.pickup_location_address ??
                    tables.businesses.find((b) => b.id === order.business_id)?.address ??
                    null)
                  : null,
            },
            items: structuredClone(items),
          },
          error: null,
        };
      }
      if (fnName === "storefront_order_tracking_token") {
        // Mirrors the database: failed lookups per (business, phone) are counted and a limited
        // phone is refused whether or not the order exists.
        const lookupKey = `${String(args.p_business_id)}:${String(args.p_phone).trim()}`;
        lookupMisses = lookupMisses.filter((m) => Date.now() - m.at < RATE_LIMIT_WINDOW_MS);
        if (
          lookupMisses.filter((m) => m.key === lookupKey).length >=
          LOOKUP_RATE_LIMIT_PHONE_MAX_REQUESTS
        ) {
          return {
            data: null,
            error: { message: "RATE_LIMITED: too many lookups", code: "P0006" },
          };
        }
        const guest = tables.guests.find((g) => g.phone === args.p_phone);
        const order = guest
          ? tables.orders.find(
              (o) =>
                o.business_id === args.p_business_id &&
                o.order_number === args.p_order_number &&
                o.guest_id === guest.id,
            )
          : undefined;
        if (!order) lookupMisses.push({ key: lookupKey, at: Date.now() });
        return { data: (order?.tracking_token as string) ?? null, error: null };
      }
      if (fnName === "place_order") {
        const items = (args.p_items as Array<{ product_id: string; quantity: number }>) || [];

        // Mirrors place_order: idempotent replay, storefront caps and rate limits (see
        // supabase/migrations/20260101000014_place_order_hardening.sql).
        const businessId = String(args.p_business_id);
        const idempotencyKey = (args.p_idempotency_key as string | undefined) ?? null;
        if (idempotencyKey) {
          const prior = tables.orders.find(
            (o) =>
              o.business_id === businessId &&
              (o as { idempotency_key?: string | null }).idempotency_key === idempotencyKey,
          );
          if (prior) {
            const priorGuest = tables.guests.find((g) => g.id === prior.guest_id);
            const merged = new Map<string, number>();
            for (const it of items) {
              merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + it.quantity);
            }
            const payload = JSON.stringify([
              [...merged.entries()].toSorted(([a], [b]) => a.localeCompare(b)),
              args.p_service_type,
              args.p_requested_date,
              args.p_requested_time ?? "",
              args.p_payment_preference ?? "on_handover",
              args.p_is_asap ?? false,
            ]);
            if (
              priorGuest?.phone !== args.p_guest_phone ||
              (prior as { idempotency_payload?: string }).idempotency_payload !== payload
            ) {
              return {
                data: null,
                error: { message: "INVALID_IDEMPOTENCY_KEY: reused", code: "22023" },
              };
            }
            return {
              data: {
                order_id: prior.id,
                order_number: prior.order_number,
                tracking_token: prior.tracking_token,
                submitted_name: prior.submitted_name,
                total_amount: prior.total_amount,
                replayed: true,
              },
              error: null,
            };
          }
        }
        // Mirrors place_order's pickup location check (all channels, migration 036).
        const pickupLocationId = (args.p_pickup_location_id as string | undefined) ?? null;
        let pickupRow: (typeof tables.pickup_locations)[number] | null = null;
        if (pickupLocationId) {
          pickupRow =
            args.p_service_type === "pickup"
              ? (tables.pickup_locations.find(
                  (l) => l.id === pickupLocationId && l.business_id === businessId && l.is_active,
                ) ?? null)
              : null;
          if (!pickupRow) {
            return {
              data: null,
              error: {
                message: `INVALID_PICKUP_LOCATION: pickup location ${pickupLocationId} is not available`,
                code: "22023",
              },
            };
          }
        }
        if (args.p_channel === "storefront") {
          const perProduct = new Map<string, number>();
          for (const it of items) {
            perProduct.set(it.product_id, (perProduct.get(it.product_id) ?? 0) + it.quantity);
          }
          const fail = (message: string, code = "22023") => ({
            data: null,
            error: { message, code },
          });
          const bizSettings = tables.business_settings.find((s) => s.business_id === businessId);
          // Mirrors place_order's slot rules (migration 034) with the domain's validateSlot.
          if (bizSettings) {
            const slot = validateSlot(
              {
                weekly: bizSettings.weekly_hours as WeeklyHours | null,
                exceptions: (bizSettings.hours_exceptions ?? []) as HoursException[],
              },
              bizSettings.timezone ?? DEFAULT_TIMEZONE,
              new Date(),
              {
                date: String(args.p_requested_date),
                time: (args.p_requested_time as string | undefined) ?? null,
                isAsap: (args.p_is_asap as boolean | undefined) ?? false,
              },
            );
            if (!slot.ok) return fail(`SLOT_INVALID: ${slot.reason}`);
          }
          const pm = bizSettings?.payment_methods as Record<string, boolean> | undefined;
          const pref = String(args.p_payment_preference ?? "on_handover");
          if (pm) {
            const allowed =
              pref === "on_handover" ? (pm.cash ?? true) || (pm.card ?? false) : (pm[pref] ?? true);
            if (!allowed) {
              return fail(`INVALID_PAYMENT_PREFERENCE: ${pref} is not an enabled payment method`);
            }
          }
          if (items.length > MAX_LINES_PER_ORDER) return fail("MAX_LINES_EXCEEDED: too many");
          if ([...perProduct.values()].some((q) => q > MAX_QUANTITY_PER_LINE)) {
            return fail("MAX_LINE_QUANTITY_EXCEEDED: too many");
          }
          if ([...perProduct.values()].reduce((a, b) => a + b, 0) > MAX_QUANTITY_PER_ORDER) {
            return fail("MAX_ORDER_QUANTITY_EXCEEDED: too many");
          }
          const recent = tables.orders.filter(
            (o) =>
              o.business_id === businessId &&
              Date.now() - new Date(o.created_at).getTime() < RATE_LIMIT_WINDOW_MS,
          );
          const phoneCount = recent.filter(
            (o) => tables.guests.find((g) => g.id === o.guest_id)?.phone === args.p_guest_phone,
          ).length;
          if (
            phoneCount >= RATE_LIMIT_PHONE_MAX_REQUESTS ||
            recent.length >= RATE_LIMIT_BUSINESS_MAX_ORDERS
          ) {
            return fail("RATE_LIMITED: too many orders", "P0006");
          }
        }

        for (const item of items) {
          const prod = tables.products.find((p) => p.id === item.product_id);
          if (!prod) {
            return {
              data: null,
              error: { message: `PRODUCT_NOT_AVAILABLE: ${item.product_id}`, code: "P0003" },
            };
          }
          if (prod.stock < item.quantity) {
            return {
              data: null,
              error: { message: `INSUFFICIENT_STOCK: ${item.product_id}`, code: "P0001" },
            };
          }
        }
        for (const item of items) {
          const prod = tables.products.find((p) => p.id === item.product_id)!;
          prod.stock -= item.quantity;
        }

        let guest = tables.guests.find(
          (g) => g.business_id === args.p_business_id && g.phone === args.p_guest_phone,
        );
        let nameMismatch = false;
        if (!guest) {
          const cleanName = String(args.p_guest_name).trim().replace(/\s+/g, " ");
          guest = {
            id: crypto.randomUUID(),
            business_id: String(args.p_business_id),
            name: cleanName,
            phone: args.p_guest_phone ? String(args.p_guest_phone) : null,
            address: args.p_delivery_address ? String(args.p_delivery_address) : null,
            email: null,
            notes: null,
            created_at: new Date().toISOString(),
          };
          tables.guests.push(guest);
        } else {
          const cleanName = String(args.p_guest_name).trim().replace(/\s+/g, " ");
          if (guest.name !== cleanName) {
            if (args.p_update_guest_name) {
              guest.name = cleanName;
            } else {
              nameMismatch = true;
            }
          }
        }

        const nextOrderNumber =
          tables.orders
            .filter((o) => o.business_id === args.p_business_id)
            .reduce((max, o) => Math.max(max, o.order_number ?? 0), 0) + 1;

        let total = 0;
        const newOrderId = crypto.randomUUID();
        for (const it of items) {
          const prod = tables.products.find((p) => p.id === it.product_id)!;
          const lineTotal = prod.price * it.quantity;
          total += lineTotal;
          tables.order_items.push({
            id: crypto.randomUUID(),
            order_id: newOrderId,
            business_id: String(args.p_business_id),
            product_id: prod.id,
            product_name: prod.name,
            quantity: it.quantity,
            unit_price: prod.price,
            total_price: lineTotal,
            created_at: new Date().toISOString(),
          });
        }

        const newOrder = {
          id: newOrderId,
          business_id: String(args.p_business_id),
          order_number: nextOrderNumber,
          guest_id: guest.id,
          submitted_name: nameMismatch ? String(args.p_guest_name).trim() : null,
          service_type: args.p_service_type as "pickup" | "delivery",
          channel: args.p_channel as "storefront" | "phone" | "whatsapp" | "in-person",
          status: "NEW" as const,
          paid: "unpaid" as const,
          payment_preference:
            (args.p_payment_preference as "revolut" | "wero" | "on_handover") ?? "on_handover",
          payment_method: null,
          paid_at: null,
          refunded_at: null,
          requested_date: String(args.p_requested_date),
          requested_time: args.p_requested_time ? String(args.p_requested_time) : null,
          total_amount:
            total +
            (args.p_service_type === "delivery"
              ? (tables.business_settings.find((st) => st.business_id === args.p_business_id)
                  ?.delivery_fee ?? 0)
              : 0) +
            (pickupRow?.fee_cents ?? 0),
          pickup_location_id: pickupRow?.id ?? null,
          pickup_location_name: pickupRow?.name ?? null,
          pickup_location_address: pickupRow ? `${pickupRow.address}, ${pickupRow.postcode}` : null,
          pickup_fee_cents: pickupRow?.fee_cents ?? 0,
          tracking_token: crypto.randomUUID().replace(/-/g, ""),
          cancellation_reason: null,
          notes: args.p_notes ? String(args.p_notes) : null,
          delivery_address: args.p_delivery_address ? String(args.p_delivery_address) : null,
          status_history: [{ status: "NEW", timestamp: new Date().toISOString(), note: null }],
          idempotency_key: idempotencyKey,
          idempotency_payload: JSON.stringify([
            [
              ...items
                .reduce(
                  (acc, it) => acc.set(it.product_id, (acc.get(it.product_id) ?? 0) + it.quantity),
                  new Map<string, number>(),
                )
                .entries(),
            ].toSorted(([a], [b]) => a.localeCompare(b)),
            args.p_service_type,
            args.p_requested_date,
            args.p_requested_time ?? "",
            args.p_payment_preference ?? "on_handover",
            args.p_is_asap ?? false,
          ]),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        tables.orders.push(newOrder);

        return {
          data: {
            order_id: newOrder.id,
            order_number: newOrder.order_number,
            tracking_token: newOrder.tracking_token,
            submitted_name: newOrder.submitted_name,
            total_amount: newOrder.total_amount,
            replayed: false,
          },
          error: null,
        };
      }
      // The order-state functions below mirror supabase/migrations/20260101000024-26 closely enough
      // to run the shared contract suites; the real behaviour is proved by pgTAP and the live suite.
      type FakeOrder = (typeof tables.orders)[number];
      const dbError = (code: string, message: string) => ({
        data: null,
        error: { code, message },
      });
      const findFakeOrder = (): FakeOrder | undefined =>
        tables.orders.find((o) => o.business_id === args.p_business_id && o.id === args.p_order_id);
      const notFound = () => dbError("P0002", "ORDER_NOT_FOUND: order not found");
      const history = (o: FakeOrder, status: string, note: string | null) => {
        o.status_history = [
          ...((o.status_history as unknown[]) ?? []),
          { status, timestamp: new Date().toISOString(), note },
        ] as Json;
        o.updated_at = new Date().toISOString();
      };
      const applyFakeTransition = (
        order: FakeOrder,
        next: OrderStatus,
        reason: string | null,
        requireReason: boolean,
      ) => {
        const trimmed = reason?.trim() || null;
        const validation = validateOrderTransition({
          currentStatus: order.status as OrderStatus,
          nextStatus: next,
          paid: order.paid as Order["paid"],
          reason: requireReason ? trimmed : (trimmed ?? "n/a"),
        });
        if (!validation.ok)
          return dbError("22023", `INVALID_STATUS_TRANSITION: ${validation.error}`);
        if (next === "CANCELLED") {
          for (const item of tables.order_items.filter((it) => it.order_id === order.id)) {
            const prod = tables.products.find((p) => p.id === item.product_id);
            if (prod) prod.stock += item.quantity;
          }
          order.cancellation_reason = trimmed ?? order.cancellation_reason;
        }
        order.status = next;
        history(order, next, trimmed);
        return null;
      };

      if (fnName === "cancel_order") {
        const order = findFakeOrder();
        if (!order) return notFound();
        const failed = applyFakeTransition(
          order,
          "CANCELLED",
          (args.p_cancellation_reason as string | undefined) ?? null,
          false,
        );
        if (failed) return failed;
        return {
          data: {
            order_id: order.id,
            status: "CANCELLED",
            cancellation_reason: order.cancellation_reason,
          },
          error: null,
        };
      }
      if (fnName === "transition_order_status") {
        const order = findFakeOrder();
        if (!order) return notFound();
        if (order.status !== args.p_expected_status) {
          return dbError("P0007", "ORDER_STATE_CONFLICT: expected status differs");
        }
        const failed = applyFakeTransition(
          order,
          args.p_new_status as OrderStatus,
          (args.p_reason as string | undefined) ?? null,
          true,
        );
        if (failed) return failed;
        return { data: { order_id: order.id, status: order.status }, error: null };
      }
      if (fnName === "record_order_payment") {
        const order = findFakeOrder();
        if (!order) return notFound();
        if (order.status === "CANCELLED" || order.paid !== "unpaid") {
          return dbError("22023", "INVALID_PAYMENT_STATE: payment cannot be recorded");
        }
        if (args.p_and_complete) {
          if (order.status !== "READY") {
            return dbError("P0007", "ORDER_STATE_CONFLICT: order must be READY");
          }
          order.status = "COMPLETED";
          history(order, "COMPLETED", `Paid via ${String(args.p_payment_method)} and completed`);
        }
        order.paid = "paid";
        order.payment_method = args.p_payment_method as typeof order.payment_method;
        order.paid_at = new Date().toISOString();
        return { data: { order_id: order.id }, error: null };
      }
      if (fnName === "mark_order_unpaid") {
        const order = findFakeOrder();
        if (!order) return notFound();
        if (order.status === "COMPLETED" || order.paid !== "paid") {
          return dbError("22023", "INVALID_PAYMENT_STATE: cannot mark as unpaid");
        }
        order.paid = "unpaid";
        order.payment_method = null;
        order.paid_at = null;
        history(order, order.status, "Payment marked as unpaid (undone)");
        return { data: { order_id: order.id }, error: null };
      }
      if (fnName === "record_order_refund") {
        const order = findFakeOrder();
        if (!order) return notFound();
        if (order.paid !== "paid") {
          return dbError("22023", "INVALID_PAYMENT_STATE: only a paid order can be refunded");
        }
        const reason = (args.p_reason as string | undefined)?.trim();
        order.paid = "refunded";
        order.refunded_at = new Date().toISOString();
        history(order, order.status, reason ? `Refund recorded: ${reason}` : "Refund recorded");
        return { data: { order_id: order.id }, error: null };
      }
      if (fnName === "replace_order_items") {
        const order = findFakeOrder();
        if (!order) return notFound();
        if (
          order.status === "COMPLETED" ||
          order.status === "CANCELLED" ||
          order.paid !== "unpaid"
        ) {
          return dbError("P0007", "ORDER_STATE_CONFLICT: order is closed");
        }
        const requested = (args.p_items as Array<{ product_id: string; quantity: number }>) ?? [];
        if (requested.length === 0) return dbError("22023", "INVALID_ORDER_ITEMS: empty");
        const wanted = new Map<string, number>();
        for (const it of requested) {
          wanted.set(it.product_id, (wanted.get(it.product_id) ?? 0) + it.quantity);
        }
        const current = tables.order_items.filter((it) => it.order_id === order.id);
        const oldQty = (pid: string) =>
          current.filter((it) => it.product_id === pid).reduce((n, it) => n + it.quantity, 0);
        for (const [pid, qty] of wanted) {
          const prod = tables.products.find(
            (p) => p.id === pid && p.business_id === order.business_id,
          );
          if (!prod) return dbError("P0002", "PRODUCT_NOT_FOUND: product not found");
          if (qty - oldQty(pid) > prod.stock) return dbError("P0001", "INSUFFICIENT_STOCK: stock");
        }
        for (const pid of new Set([...wanted.keys(), ...current.map((it) => it.product_id)])) {
          const prod = tables.products.find((p) => p.id === pid);
          if (prod) prod.stock -= (wanted.get(pid as string) ?? 0) - oldQty(pid as string);
        }
        let subtotal = 0;
        const next = [...wanted].map(([pid, qty]) => {
          const existing = current.find((it) => it.product_id === pid);
          const prod = tables.products.find((p) => p.id === pid)!;
          const unit = existing?.unit_price ?? prod.price;
          subtotal += unit * qty;
          return {
            id: crypto.randomUUID(),
            order_id: order.id,
            business_id: order.business_id,
            product_id: pid,
            product_name: existing?.product_name ?? prod.name,
            quantity: qty,
            unit_price: unit,
            total_price: unit * qty,
            created_at: new Date().toISOString(),
          };
        });
        tables.order_items = [
          ...tables.order_items.filter((it) => it.order_id !== order.id),
          ...next,
        ];
        const settings = tables.business_settings.find(
          (st) => st.business_id === order.business_id,
        );
        order.total_amount =
          subtotal + (order.service_type === "delivery" ? (settings?.delivery_fee ?? 0) : 0);
        order.updated_at = new Date().toISOString();
        return { data: { order_id: order.id, total_amount: order.total_amount }, error: null };
      }
      throw new Error(`Unhandled RPC: ${fnName}`);
    },
  };

  return fakeClient as unknown as SupabaseClient<Database>;
}

describe("Supabase Repository Adapter", () => {
  // In-memory fake client: retained to provide unit coverage for adapter mappings,
  // error translations and domain validation without requiring a live database in unit CI gates.
  // The live contract suite lives in supabase-live.contract.test.ts and runs against local Supabase.
  describe("Supabase Adapter (Mocked Client)", () => {
    let mockRepos: Repositories;

    beforeEach(() => {
      const fakeClient = createFakeSupabaseClient();
      mockRepos = createSupabaseRepositories(fakeClient);
    });

    describeRepositoryContracts("Supabase Adapter (Mocked Client)", () => mockRepos, {
      // The demo hours make storefront orders depend on the time of day; the suite clears them.
      setOpeningHours: async (hours) => {
        await mockRepos.business.updateSettings(DEMO_BUSINESS_ID, hours);
      },
    });
  });

  describe("publicOnly option on createSupabaseRepositories", () => {
    it("selects only public settings columns and applies domain defaults to private fields", async () => {
      const fakeClient = createFakeSupabaseClient();
      const repos = createSupabaseRepositories(fakeClient, { publicOnly: true });

      const settings = await repos.business.getSettings(DEMO_BUSINESS_ID);
      expect(settings).not.toBeNull();
      expect(settings?.currency).toBe("EUR");
      expect(settings?.acceptingOrders).toBe(true);
      expect(settings?.dateFormat).toBe("DD/MM/YYYY");
      expect(settings?.lowStockThreshold).toBe(5);
      expect(settings?.taxPercentage).toBe(0);
      expect(settings?.notifications).toBe(true);
      expect(settings?.weeklyHours).toBeNull();
      expect(settings?.hoursExceptions).toEqual([]);
      expect(settings?.timezone).toBe("Europe/Paris");
    });

    it("carries configured weeklyHours, hoursExceptions and timezone through publicOnly settings reads", async () => {
      const fixtures = createDefaultFixtures();
      const customHours = {
        mon: [],
        tue: [{ open: "11:30", close: "14:30" }],
        wed: [],
        thu: [],
        fri: [{ open: "18:00", close: "24:00" }],
        sat: [{ open: "00:00", close: "01:00" }],
        sun: [],
      };
      const customExceptions = [
        { from: "2026-07-30", to: "2026-08-03", ranges: [], note: "Congés annuels" },
      ];
      fixtures.settings.weeklyHours = customHours;
      fixtures.settings.hoursExceptions = customExceptions;
      fixtures.settings.timezone = "Africa/Douala";
      const fakeClient = createFakeSupabaseClient(fixtures);
      const repos = createSupabaseRepositories(fakeClient, { publicOnly: true });

      const settings = await repos.business.getSettings(DEMO_BUSINESS_ID);
      expect(settings?.weeklyHours).toEqual(customHours);
      expect(settings?.hoursExceptions).toEqual(customExceptions);
      expect(settings?.timezone).toBe("Africa/Douala");
    });

    it("selects full settings row when publicOnly is false or omitted", async () => {
      const fakeClient = createFakeSupabaseClient();
      const repos = createSupabaseRepositories(fakeClient);

      const settings = await repos.business.getSettings(DEMO_BUSINESS_ID);
      expect(settings).not.toBeNull();
      expect(settings?.dateFormat).toBeDefined();
      expect(settings?.lowStockThreshold).toBeDefined();
    });
  });

  describe("error mapping in Supabase adapter", () => {
    it("maps pickup rule violations to CONFLICT ActionErrors with a reason", async () => {
      const repos = createSupabaseRepositories(createFakeSupabaseClient());
      const failing = (message: string) =>
        createSupabaseRepositories({
          from: () => {
            const builder: Record<string, unknown> = {};
            for (const m of ["update", "delete", "select", "eq"]) builder[m] = () => builder;
            builder.maybeSingle = async () => ({ data: null, error: { code: "23514", message } });
            return builder;
          },
        } as unknown as SupabaseClient<Database>);

      const last = failing("LAST_PICKUP_OPTION: pickup needs at least one active option");
      await expect(
        last.pickupLocations.update(DEMO_BUSINESS_ID, "e1000000-0000-4000-8000-000000000001", {
          isActive: false,
        }),
      ).rejects.toMatchObject({
        name: "ActionError",
        code: "CONFLICT",
        options: { reason: "LAST_PICKUP_OPTION" },
      });
      await expect(
        last.pickupLocations.delete(DEMO_BUSINESS_ID, "e1000000-0000-4000-8000-000000000001"),
      ).rejects.toMatchObject({ code: "CONFLICT", options: { reason: "LAST_PICKUP_OPTION" } });
      await expect(
        last.business.updateSettings(DEMO_BUSINESS_ID, { shopPickupEnabled: false }),
      ).rejects.toMatchObject({ code: "CONFLICT", options: { reason: "LAST_PICKUP_OPTION" } });

      // A reorder with a partial id set surfaces the raw database error.
      await expect(
        repos.pickupLocations.reorder(DEMO_BUSINESS_ID, ["e1000000-0000-4000-8000-000000000001"]),
      ).rejects.toMatchObject({ code: "22023" });
    });

    it("maps place_order errors accurately", async () => {
      const fakeClient = createFakeSupabaseClient();
      const repos = createSupabaseRepositories(fakeClient);
      // The demo hours would make these placements depend on the time of day.
      await repos.business.updateSettings(DEMO_BUSINESS_ID, {
        weeklyHours: null,
        hoursExceptions: [],
      });

      // P0001 insufficient stock
      await expect(
        repos.orders.place(DEMO_BUSINESS_ID, {
          guestName: "Alice",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
          items: [
            // Above the demo stock (45) but within the per-line cap that place_order also enforces.
            { productId: "33333333-3333-4333-8333-333333333301", quantity: MAX_QUANTITY_PER_LINE },
          ],
        }),
      ).rejects.toMatchObject({
        code: "STOCK_ERROR",
        message: expect.not.stringContaining("INSUFFICIENT"),
      });

      // P0003 product not found
      await expect(
        repos.orders.place(DEMO_BUSINESS_ID, {
          guestName: "Alice",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
          items: [{ productId: "99999999-9999-4999-8999-999999999999", quantity: 1 }],
        }),
      ).rejects.toMatchObject({
        code: "STOCK_ERROR",
        message: expect.not.stringContaining("PRODUCT_NOT"),
      });

      // Custom error codes via client mock
      const rpcMock = vi.fn(async () => ({
        data: null,
        error: { code: "P0004", message: "ORDERS_NOT_ACCEPTED" },
      }));
      const rpcClient = {
        ...fakeClient,
        rpc: rpcMock,
      } as unknown as SupabaseClient<Database>;
      const rpcRepos = createSupabaseRepositories(rpcClient);
      await expect(
        rpcRepos.orders.place(DEMO_BUSINESS_ID, {
          guestName: "Alice",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
          items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: "STORE_CLOSED" });

      // P0005 min order
      rpcMock.mockImplementationOnce(async () => ({
        data: null,
        error: { code: "P0005", message: "MINIMUM_ORDER_NOT_MET" },
      }));
      await expect(
        rpcRepos.orders.place(DEMO_BUSINESS_ID, {
          guestName: "Alice",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
          items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: "MINIMUM_ORDER_UNMET" });

      // 42501 unauthorized
      rpcMock.mockImplementationOnce(async () => ({
        data: null,
        error: { code: "42501", message: "permission denied" },
      }));
      await expect(
        rpcRepos.orders.place(DEMO_BUSINESS_ID, {
          guestName: "Alice",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
          items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

      // 22023 invalid input
      rpcMock.mockImplementationOnce(async () => ({
        data: null,
        error: { code: "22023", message: "INVALID_PARAMETER" },
      }));
      await expect(
        rpcRepos.orders.place(DEMO_BUSINESS_ID, {
          guestName: "Alice",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
          items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });

      // generic error
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      rpcMock.mockImplementationOnce(async () => ({
        data: null,
        error: { code: "UNKNOWN", message: "Unexpected failure" },
      }));
      await expect(
        rpcRepos.orders.place(DEMO_BUSINESS_ID, {
          guestName: "Alice",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
          items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
        }),
      ).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
        message: "We could not place your order. Please try again.",
      });
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("maps SLOT_INVALID reasons to typed slot errors and passes p_is_asap", async () => {
      const rpc = vi.fn(async (_fn: string, _args: unknown) => ({
        data: null,
        error: { code: "22023", message: "SLOT_INVALID: closed_now" } as {
          code: string;
          message: string;
        },
      }));
      const repos = createSupabaseRepositories({ rpc } as unknown as SupabaseClient<Database>);
      const place = () =>
        repos.orders.place(DEMO_BUSINESS_ID, {
          guestName: "Alice",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
          isAsap: true,
          items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
        });

      await expect(place()).rejects.toMatchObject({ code: "SLOT_CLOSED_NOW" });
      expect(rpc).toHaveBeenCalledWith("place_order", expect.objectContaining({ p_is_asap: true }));

      const expected = {
        closed_day: "SLOT_CLOSED_DAY",
        date_out_of_window: "SLOT_DATE_OUT_OF_WINDOW",
        time_outside_hours: "SLOT_TIME_OUTSIDE_HOURS",
        time_in_past: "SLOT_TIME_IN_PAST",
      };
      for (const [reason, code] of Object.entries(expected)) {
        rpc.mockResolvedValueOnce({
          data: null,
          error: { code: "22023", message: `SLOT_INVALID: ${reason}` },
        });
        await expect(place()).rejects.toMatchObject({ code });
      }

      // An unknown reason never leaks: it is a generic invalid-input error.
      rpc.mockResolvedValueOnce({
        data: null,
        error: { code: "22023", message: "SLOT_INVALID: secret details" },
      });
      await expect(place()).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });

    it("passes p_pickup_location_id and maps the pickup location errors", async () => {
      const locationId = "44444444-4444-4444-8444-444444444444";
      const rpc = vi.fn(async (_fn: string, _args: unknown) => ({
        data: null,
        error: { code: "22023", message: "INVALID_PICKUP_LOCATION: gone" } as {
          code: string;
          message: string;
        },
      }));
      const repos = createSupabaseRepositories({ rpc } as unknown as SupabaseClient<Database>);
      const place = (pickupLocationId?: string | null) =>
        repos.orders.place(DEMO_BUSINESS_ID, {
          guestName: "Alice",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
          pickupLocationId,
          items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
        });

      await expect(place(locationId)).rejects.toMatchObject({ code: "PICKUP_LOCATION_INVALID" });
      expect(rpc).toHaveBeenCalledWith(
        "place_order",
        expect.objectContaining({ p_pickup_location_id: locationId }),
      );

      await place(null).catch(() => undefined);
      expect(rpc).toHaveBeenLastCalledWith(
        "place_order",
        expect.objectContaining({ p_pickup_location_id: undefined }),
      );

      for (const [message, code] of [
        ["PICKUP_LOCATION_REQUIRED: choose a pickup location", "PICKUP_LOCATION_REQUIRED"],
        ["PICKUP_NOT_AVAILABLE: no pickup option is available", "PICKUP_NOT_AVAILABLE"],
      ] as const) {
        rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message } });
        await expect(place()).rejects.toMatchObject({ code });
      }
    });

    it("maps place_order error prefixes to codes without leaking database text", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const place = async (message: string, code = "XX000") => {
        const rpc = vi.fn(async () => ({ data: null, error: { code, message } }));
        const repos = createSupabaseRepositories({
          ...createFakeSupabaseClient(),
          rpc,
        } as unknown as SupabaseClient<Database>);
        return repos.orders
          .place(DEMO_BUSINESS_ID, {
            guestName: "Alice",
            guestPhone: "+33612345678",
            serviceType: "pickup",
            channel: "storefront",
            requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
            items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
          })
          .catch((err: unknown) => err);
      };
      expect(await place("INSUFFICIENT_STOCK: product x has 1 in stock")).toMatchObject({
        code: "STOCK_ERROR",
      });
      expect(await place("ORDERS_NOT_ACCEPTED: business x")).toMatchObject({
        code: "STORE_CLOSED",
      });
      expect(await place("SERVICE_TYPE_NOT_AVAILABLE: delivery is not available")).toMatchObject({
        code: "SERVICE_TYPE_DISABLED",
      });
      expect(await place("MINIMUM_ORDER_AMOUNT_NOT_MET: subtotal 1")).toMatchObject({
        code: "MINIMUM_ORDER_UNMET",
      });
      for (const message of [
        "MAX_LINE_QUANTITY_EXCEEDED: at most 50 per product",
        "MAX_ORDER_QUANTITY_EXCEEDED: at most 100 items per order",
        "MAX_LINES_EXCEEDED: an order may contain at most 50 lines",
        "RATE_LIMITED: too many orders, try again later",
      ]) {
        expect(await place(message, "22023")).toMatchObject({ code: "ANTI_ABUSE_REJECTION" });
      }
      expect(await place("whatever", "P0006")).toMatchObject({ code: "ANTI_ABUSE_REJECTION" });
      for (const message of [
        "INVALID_PAYMENT_PREFERENCE: wero is not an enabled payment method",
        "INVALID_REQUESTED_DATE: requested_date is too far ahead",
        "INVALID_REQUESTED_TIME: requested_time must be a whole minute",
        "INVALID_GUEST_PHONE: phone must be in E.164 format",
        "INVALID_IDEMPOTENCY_KEY: key was already used for a different order",
      ]) {
        expect(await place(message, "22023")).toMatchObject({ code: "INVALID_INPUT" });
      }
      expect(await place("INVALID_DELIVERY_ADDRESS: secret detail")).toMatchObject({
        code: "INVALID_INPUT",
        message: "Please check your order details.",
      });
      const unknown = await place('relation "orders" exploded at 10.0.0.1');
      expect(unknown).toMatchObject({ code: "INTERNAL_ERROR" });
      expect((unknown as Error).message).not.toContain("exploded");
      // Only SQLSTATE and an error prefix are logged, never free-text database messages.
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("exploded");
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("10.0.0.1");
      errorSpy.mockRestore();
    });

    it("passes the idempotency key to place_order and maps the lookup rate limit", async () => {
      const rpc = vi.fn(async (fn: string) =>
        fn === "place_order"
          ? {
              data: {
                order_id: "11111111-1111-4111-8111-111111111111",
                order_number: 7,
                tracking_token: "tk",
                submitted_name: null,
                total_amount: 100,
                replayed: true,
              },
              error: null,
            }
          : { data: null, error: { code: "P0006", message: "RATE_LIMITED: too many lookups" } },
      );
      const repos = createSupabaseRepositories({
        rpc,
      } as unknown as SupabaseClient<Database>);
      const idempotencyKey = "f0000000-0000-4000-8000-000000000042";

      const placed = await repos.orders.place(DEMO_BUSINESS_ID, {
        guestName: "Alice",
        guestPhone: "+33612345678",
        serviceType: "pickup",
        channel: "storefront",
        requestedDate: getZonedDay(new Date(), DEFAULT_TIMEZONE),
        items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
        idempotencyKey,
      });

      expect(rpc).toHaveBeenCalledWith(
        "place_order",
        expect.objectContaining({ p_idempotency_key: idempotencyKey }),
      );
      expect(placed.replayed).toBe(true);
      await expect(
        repos.orders.findTrackingTokenByTicketAndPhone(DEMO_BUSINESS_ID, 7, "+33612345678"),
      ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    });

    it("reads featured aggregates via the public RPC in publicOnly mode", async () => {
      const rpc = vi.fn(async () => ({
        data: [{ product_id: "p1", quantity: 3, last_ordered_at: "2026-10-31T12:00:00+00:00" }],
        error: null,
      }));
      const from = vi.fn();
      const repos = createSupabaseRepositories(
        { rpc, from } as unknown as SupabaseClient<Database>,
        {
          publicOnly: true,
        },
      );
      const filter = { fromDate: "2026-10-24T12:00:00.000Z", toDate: "2026-10-31T12:00:00.000Z" };
      await expect(repos.orders.sumQuantitiesByProduct(DEMO_BUSINESS_ID, filter)).resolves.toEqual([
        { productId: "p1", quantity: 3, lastOrderedAt: "2026-10-31T12:00:00.000Z" },
      ]);
      expect(rpc).toHaveBeenCalledWith("storefront_featured_products", {
        p_business_id: DEMO_BUSINESS_ID,
        p_from: filter.fromDate,
        p_to: filter.toDate,
      });
      expect(from).not.toHaveBeenCalled();

      rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } } as never);
      await expect(repos.orders.sumQuantitiesByProduct(DEMO_BUSINESS_ID, filter)).rejects.toEqual({
        message: "boom",
      });
    });

    it("selects only public product columns in publicOnly mode", async () => {
      const select = vi.fn();
      const chain: Record<string, unknown> = {};
      const row = {
        id: "33333333-3333-4333-8333-333333333301",
        business_id: DEMO_BUSINESS_ID,
        category_id: "22222222-2222-4222-8222-222222222201",
        name: "Poulet Braisé",
        description: null,
        price: 1500,
        stock: 3,
        visible: true,
        suggest_add_ons: true,
        allergens: [],
        image_url: null,
      };
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({ data: row, error: null });
      chain.then = (resolve: (value: unknown) => void) => resolve({ data: [row], error: null });
      select.mockReturnValue(chain);
      const client = { from: () => ({ select }) } as unknown as SupabaseClient<Database>;
      const repos = createSupabaseRepositories(client, { publicOnly: true });

      const listed = await repos.products.list(DEMO_BUSINESS_ID, { visibleOnly: true });
      const found = await repos.products.findById(DEMO_BUSINESS_ID, row.id);

      for (const [columns] of select.mock.calls) {
        expect(columns).toBe(PUBLIC_PRODUCT_COLUMNS);
        expect(columns).not.toContain("unit_cost");
      }
      expect(listed[0]).toMatchObject({ id: row.id, price: 1500, stock: 3, unitCost: 0 });
      expect(found?.name).toBe("Poulet Braisé");
    });

    it("maps cancel_order errors accurately", async () => {
      const fakeClient = createFakeSupabaseClient();
      const repos = createSupabaseRepositories(fakeClient);

      // P0002 order not found
      await expect(
        repos.orders.cancel(DEMO_BUSINESS_ID, "00000000-0000-0000-0000-000000000099"),
      ).rejects.toThrowError("Order not found");

      // 22023 invalid status transition
      const cancelRpcMock = vi.fn(async () => ({
        data: null,
        error: { code: "22023", message: "INVALID_STATUS_TRANSITION" },
      }));
      const rpcClient = {
        ...fakeClient,
        rpc: cancelRpcMock,
      } as unknown as SupabaseClient<Database>;
      const rpcRepos = createSupabaseRepositories(rpcClient);
      await expect(
        rpcRepos.orders.cancel(DEMO_BUSINESS_ID, "00000000-0000-0000-0000-000000000001"),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });

      // 42501 unauthorized
      cancelRpcMock.mockImplementationOnce(async () => ({
        data: null,
        error: { code: "42501", message: "permission denied" },
      }));
      await expect(
        rpcRepos.orders.cancel(DEMO_BUSINESS_ID, "00000000-0000-0000-0000-000000000001"),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

      // 22023 / P0007 never forward the database text, only fixed strings
      const leak = "secret detail: order 1234 price 99 at tenant xyz";
      for (const [code, message] of [
        ["22023", `INVALID_PAYMENT_STATE: ${leak}`],
        ["22023", `SOMETHING_ELSE: ${leak}`],
        ["P0007", `ORDER_STATE_CONFLICT: ${leak}`],
      ] as const) {
        cancelRpcMock.mockImplementationOnce(async () => ({
          data: null,
          error: { code, message },
        }));
        const err = await rpcRepos.orders
          .cancel(DEMO_BUSINESS_ID, "00000000-0000-0000-0000-000000000001")
          .catch((e: Error) => e);
        expect((err as Error).message).not.toContain("secret detail");
        expect((err as Error).message.length).toBeGreaterThan(0);
      }
    });

    it("maps delivery_address in findByTrackingToken only for delivery orders (#352)", async () => {
      const baseRow = {
        business_id: DEMO_BUSINESS_ID,
        order_number: 42,
        status: "CONFIRMED",
        paid: "unpaid",
        payment_preference: "on_handover",
        requested_date: "2026-10-17",
        requested_time: "12:30:00",
        total_amount: 1500,
        cancellation_reason: null,
        created_at: "2026-10-17T10:00:00+00:00",
      };
      const items = [
        { product_name: "Poulet Braisé", quantity: 1, unit_price: 1500, total_price: 1500 },
      ];
      const rpc = vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            order: {
              ...baseRow,
              service_type: "delivery",
              delivery_address: "42 Avenue des Champs-Élysées, 75008 Paris",
            },
            items,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            order: {
              ...baseRow,
              service_type: "pickup",
              delivery_address: "Stale address on pickup row",
            },
            items,
          },
          error: null,
        });
      const repos = createSupabaseRepositories({ rpc } as unknown as SupabaseClient<Database>);

      const delivery = await repos.orders.findByTrackingToken("tk-delivery");
      expect(delivery?.deliveryAddress).toBe("42 Avenue des Champs-Élysées, 75008 Paris");

      const pickup = await repos.orders.findByTrackingToken("tk-pickup");
      expect(pickup?.deliveryAddress).toBeNull();
    });

    it("maps pickup_location in findByTrackingToken only for pickup orders (#386)", async () => {
      const baseRow = {
        business_id: DEMO_BUSINESS_ID,
        order_number: 43,
        status: "NEW",
        paid: "unpaid",
        payment_preference: "on_handover",
        requested_date: "2026-10-17",
        requested_time: null,
        total_amount: 1650,
        cancellation_reason: null,
        created_at: "2026-10-17T10:00:00+00:00",
      };
      const items = [
        { product_name: "Poulet Braisé", quantity: 1, unit_price: 1500, total_price: 1500 },
      ];
      const rpc = vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            order: {
              ...baseRow,
              service_type: "pickup",
              pickup_location_name: "Gare du Nord",
              pickup_location_address: "18 Rue de Dunkerque, 75010",
            },
            items,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            order: {
              ...baseRow,
              service_type: "pickup",
              pickup_location_name: null,
              pickup_location_address: "9 Rue du Four, 75006 Paris",
            },
            items,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            order: {
              ...baseRow,
              service_type: "delivery",
              delivery_address: "1 rue X, 75001 Paris",
              pickup_location_name: "Stale",
              pickup_location_address: "Stale",
            },
            items,
          },
          error: null,
        });
      const repos = createSupabaseRepositories({ rpc } as unknown as SupabaseClient<Database>);

      expect((await repos.orders.findByTrackingToken("tk-relay"))?.pickupLocation).toEqual({
        name: "Gare du Nord",
        address: "18 Rue de Dunkerque, 75010",
      });
      expect((await repos.orders.findByTrackingToken("tk-shop"))?.pickupLocation).toEqual({
        name: null,
        address: "9 Rue du Four, 75006 Paris",
      });
      expect((await repos.orders.findByTrackingToken("tk-delivery"))?.pickupLocation).toBeNull();
    });
  });
});
