// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repositories } from "@/domain/repositories";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createDefaultFixtures, DEMO_BUSINESS_ID, type MockFixtures } from "../mock/fixtures";
import { createSupabaseRepositories } from "../supabase";
import { describeRepositoryContracts } from "./contracts";

function createFakeSupabaseClient(
  initialFixtures: MockFixtures = createDefaultFixtures(),
): SupabaseClient<Database> {
  const fixtures = structuredClone(initialFixtures);
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
        name: "Secondary Test Bakery",
        slug: "secondary-test-bakery",
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
        order_timing_asap: fixtures.settings.orderTimingAsap,
        order_timing_scheduled: fixtures.settings.orderTimingScheduled,
        order_timing_time_optional: fixtures.settings.orderTimingTimeOptional,
        delivery_fee: fixtures.settings.deliveryFee,
        min_order_amount: fixtures.settings.minOrderAmount,
        lead_time_value: fixtures.settings.leadTimeValue,
        lead_time_unit: fixtures.settings.leadTimeUnit,
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
    let orderConfig: { col: string; ascending: boolean } | undefined;
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
        orderConfig = { col, ascending: opts?.ascending ?? true };
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
              order_timing_asap: true,
              order_timing_scheduled: true,
              order_timing_time_optional: true,
              delivery_fee: 0,
              min_order_amount: 0,
              lead_time_value: 1,
              lead_time_unit: "business_days",
              revolut_revtag: "",
              wero_identifier: "",
              payment_methods: { cash: true, revolut: true, wero: true },
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
              table === "business_settings"
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
      if (orderConfig) {
        const { col, ascending } = orderConfig;
        result = result.toSorted((a, b) => {
          const valA = a[col] as string | number;
          const valB = b[col] as string | number;
          if (valA < valB) return ascending ? -1 : 1;
          if (valA > valB) return ascending ? 1 : -1;
          return 0;
        });
      }
      if (limitCount !== undefined) {
        result = result.slice(0, limitCount);
      }
      let finalResult = structuredClone(result);
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
      if (fnName === "get_order_by_tracking_token") {
        const order = tables.orders.find((o) => o.tracking_token === args.p_tracking_token);
        if (!order) return { data: null, error: null };
        const items = tables.order_items.filter((it) => it.order_id === order.id);
        return {
          data: { order: structuredClone(order), items: structuredClone(items) },
          error: null,
        };
      }
      if (fnName === "storefront_order_tracking_token") {
        const guest = tables.guests.find((g) => g.phone === args.p_phone);
        if (!guest) return { data: null, error: null };
        const order = tables.orders.find(
          (o) =>
            o.business_id === args.p_business_id &&
            o.order_number === args.p_order_number &&
            o.guest_id === guest.id,
        );
        return { data: (order?.tracking_token as string) ?? null, error: null };
      }
      if (fnName === "place_order") {
        const items = (args.p_items as Array<{ product_id: string; quantity: number }>) || [];
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
          total_amount: total,
          tracking_token: crypto.randomUUID().replace(/-/g, ""),
          cancellation_reason: null,
          notes: args.p_notes ? String(args.p_notes) : null,
          delivery_address: args.p_delivery_address ? String(args.p_delivery_address) : null,
          status_history: [{ status: "NEW", timestamp: new Date().toISOString(), note: null }],
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
          },
          error: null,
        };
      }
      if (fnName === "cancel_order") {
        const order = tables.orders.find(
          (o) => o.business_id === args.p_business_id && o.id === args.p_order_id,
        );
        if (!order) {
          return { data: null, error: { message: "ORDER_NOT_FOUND", code: "P0002" } };
        }
        if (order.status === "COMPLETED" || order.status === "CANCELLED") {
          return {
            data: null,
            error: { message: "INVALID_STATUS_TRANSITION", code: "22023" },
          };
        }

        const orderItems = tables.order_items.filter((it) => it.order_id === order.id);
        for (const item of orderItems) {
          const prod = tables.products.find((p) => p.id === item.product_id);
          if (prod) {
            prod.stock += item.quantity;
          }
        }

        order.status = "CANCELLED";
        order.cancellation_reason =
          (args.p_cancellation_reason as string) ?? order.cancellation_reason;
        order.updated_at = new Date().toISOString();

        return {
          data: {
            order_id: order.id,
            status: "CANCELLED",
            cancellation_reason: order.cancellation_reason,
          },
          error: null,
        };
      }
      if (fnName === "replace_order_items") {
        const order = tables.orders.find(
          (o) => o.business_id === args.p_business_id && o.id === args.p_order_id,
        );
        if (!order) {
          return { data: null, error: { message: "ORDER_NOT_FOUND", code: "P0002" } };
        }
        tables.order_items = tables.order_items.filter((it) => it.order_id !== order.id);
        const newItems = (args.p_items as Array<Record<string, unknown>>) || [];
        for (const it of newItems) {
          tables.order_items.push({
            id: (it.id as string) || crypto.randomUUID(),
            order_id: order.id,
            business_id: String(args.p_business_id),
            product_id: (it.product_id as string) || "00000000-0000-0000-0000-000000000000",
            product_name: String(it.product_name || "Item"),
            quantity: Number(it.quantity || 1),
            unit_price: Number(it.unit_price || 0),
            total_price: Number(it.total_price || 0),
            created_at: new Date().toISOString(),
          });
        }
        return { data: null, error: null };
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

    describeRepositoryContracts("Supabase Adapter (Mocked Client)", () => mockRepos);
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
    it("maps place_order errors accurately", async () => {
      const fakeClient = createFakeSupabaseClient();
      const repos = createSupabaseRepositories(fakeClient);

      // P0001 insufficient stock
      await expect(
        repos.orders.place(DEMO_BUSINESS_ID, {
          guestName: "Alice",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: "2026-10-15",
          items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 99999 }],
        }),
      ).rejects.toThrowError("INSUFFICIENT_STOCK");

      // P0003 product not found
      await expect(
        repos.orders.place(DEMO_BUSINESS_ID, {
          guestName: "Alice",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: "2026-10-15",
          items: [{ productId: "99999999-9999-4999-8999-999999999999", quantity: 1 }],
        }),
      ).rejects.toThrowError("PRODUCT_NOT_AVAILABLE");

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
          requestedDate: "2026-10-15",
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
          requestedDate: "2026-10-15",
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
          requestedDate: "2026-10-15",
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
          requestedDate: "2026-10-15",
          items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });

      // generic error
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
          requestedDate: "2026-10-15",
          items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
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
    });
  });
});
