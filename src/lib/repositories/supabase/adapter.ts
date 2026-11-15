import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { managerBusinessSummarySchema } from "@/domain/auth";
import {
  businessMemberRoleSchema,
  businessMemberSchema,
  businessSchema,
  businessSettingsSchema,
  type Business,
  type BusinessMember,
  type BusinessMemberRole,
  type BusinessSettings,
} from "@/domain/business";
import { uuidSchema } from "@/domain/common";
import { expenseSchema, type Expense } from "@/domain/expense";
import { sumOrderProductQuantities, type ProductQuantityFilter } from "@/domain/featured";
import { guestSchema, normalizeGuestName, normalizePhoneNumber, type Guest } from "@/domain/guest";
import {
  cancelOrderResultSchema,
  orderSchema,
  OrderRepoError,
  placedOrderSummarySchema,
  publicOrderSchema,
  type CancelOrderResult,
  type Order,
  type OrderStatus,
  type PlaceOrderRepoInput,
  type PlacedOrderSummary,
  type PublicOrder,
} from "@/domain/order";
import {
  productCategorySchema,
  productSchema,
  type Product,
  type ProductCategory,
} from "@/domain/product";
import type {
  BusinessRepository,
  CategoryRepository,
  CreateBusinessInput,
  CreateCategoryInput,
  CreateExpenseInput,
  CreateGuestInput,
  CreateMemberInput,
  CreateOrderInput,
  CreateProductInput,
  ExpenseFilter,
  ExpenseRepository,
  GuestRepository,
  MemberRepository,
  OrderFilter,
  OrderRepository,
  ProductFilter,
  ProductRepository,
  Repositories,
  UpdateBusinessInput,
  UpdateCategoryInput,
  UpdateExpenseInput,
  UpdateGuestInput,
  UpdateOrderInput,
  UpdateProductInput,
  UpdateSettingsInput,
  UserMembershipSummary,
} from "@/domain/repositories";
import type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/lib/supabase/database.types";

export type SupabaseClientFactory =
  SupabaseClient<Database> | (() => Promise<SupabaseClient<Database>> | SupabaseClient<Database>);

export interface SupabaseRepositoryOptions {
  readonly publicOnly?: boolean;
}

export const PUBLIC_BUSINESS_SETTINGS_COLUMNS =
  "id, business_id, currency, accepting_orders, service_types, opening_hours, order_timing_asap, order_timing_scheduled, order_timing_time_optional, delivery_fee, min_order_amount, lead_time_value, lead_time_unit, revolut_revtag, wero_identifier, payment_methods, payment_instructions_en, payment_instructions_fr";

type OrderRowWithItems = Tables<"orders"> & {
  order_items: Tables<"order_items">[];
};

function toIsoUtc(value: unknown): string {
  if (typeof value !== "string" || !value) {
    return new Date().toISOString();
  }
  if (value.endsWith("Z")) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function mapProductRow(row: Tables<"products">): Product {
  return productSchema.parse({
    id: row.id,
    businessId: row.business_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    price: row.price,
    unitCost: row.unit_cost,
    stock: row.stock,
    visible: row.visible,
    allergens: row.allergens as Product["allergens"],
    suggestAddOns: row.suggest_add_ons,
    imageUrl: row.image_url,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  });
}

function mapCategoryRow(row: Tables<"product_categories">): ProductCategory {
  return productCategorySchema.parse({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    sortOrder: row.sort_order,
    role: row.role,
    createdAt: toIsoUtc(row.created_at),
  });
}

function mapOrderRow(row: OrderRowWithItems): Order {
  const items = (row.order_items ?? []).map((it) => ({
    id: it.id,
    productId: it.product_id ?? "00000000-0000-0000-0000-000000000000",
    productName: it.product_name,
    quantity: it.quantity,
    unitPrice: it.unit_price,
    totalPrice: it.total_price,
  }));

  const statusHistory = Array.isArray(row.status_history)
    ? (row.status_history as Array<Record<string, unknown>>).map((entry) => ({
        ...entry,
        timestamp: toIsoUtc(entry.timestamp),
      }))
    : [];

  return orderSchema.parse({
    id: row.id,
    businessId: row.business_id,
    orderNumber: row.order_number,
    guestId: row.guest_id,
    submittedName: row.submitted_name,
    serviceType: row.service_type,
    channel: row.channel,
    status: row.status,
    paid: row.paid,
    paymentPreference: row.payment_preference,
    paymentMethod: row.payment_method,
    paidAt: row.paid_at ? toIsoUtc(row.paid_at) : null,
    refundedAt: row.refunded_at ? toIsoUtc(row.refunded_at) : null,
    requestedDate: row.requested_date,
    requestedTime: row.requested_time ? row.requested_time.slice(0, 5) : null,
    items,
    totalAmount: row.total_amount,
    trackingToken: row.tracking_token,
    cancellationReason: row.cancellation_reason,
    notes: row.notes,
    deliveryAddress: row.delivery_address,
    statusHistory,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  });
}

function mapGuestRow(row: Tables<"guests">): Guest {
  return guestSchema.parse({
    id: row.id,
    businessId: row.business_id,
    name: normalizeGuestName(row.name),
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    createdAt: toIsoUtc(row.created_at),
  });
}

function mapExpenseRow(row: Tables<"expenses">): Expense {
  return expenseSchema.parse({
    id: row.id,
    businessId: row.business_id,
    amount: row.amount,
    date: row.date,
    description: row.description,
    tags: row.tags ?? [],
    createdAt: toIsoUtc(row.created_at),
  });
}

function mapBusinessRow(row: Tables<"businesses">): Business {
  return businessSchema.parse({
    id: row.id,
    name: row.name,
    slug: row.slug,
    currency: (row.currency ?? "EUR") as "EUR",
    description: row.description ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    whatsappNumber: row.whatsapp_number ?? undefined,
    instagramUrl: row.instagram_url ?? undefined,
    facebookUrl: row.facebook_url ?? undefined,
    tiktokUrl: row.tiktok_url ?? undefined,
    address: row.address ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  });
}

function mapSettingsRow(row: Partial<Tables<"business_settings">>): BusinessSettings {
  return businessSettingsSchema.parse({
    id: row.id,
    businessId: row.business_id,
    currency: (row.currency ?? "EUR") as "EUR",
    dateFormat: row.date_format ?? undefined,
    lowStockThreshold: row.low_stock_threshold ?? undefined,
    taxPercentage:
      row.tax_percentage !== undefined && row.tax_percentage !== null
        ? Number(row.tax_percentage)
        : undefined,
    notifications: row.notifications ?? undefined,
    acceptingOrders: row.accepting_orders,
    serviceTypes: row.service_types,
    openingHours: row.opening_hours,
    orderTimingAsap: row.order_timing_asap,
    orderTimingScheduled: row.order_timing_scheduled,
    orderTimingTimeOptional: row.order_timing_time_optional,
    deliveryFee: row.delivery_fee,
    minOrderAmount: row.min_order_amount,
    leadTimeValue: row.lead_time_value,
    leadTimeUnit: row.lead_time_unit,
    revolutRevtag: row.revolut_revtag,
    weroIdentifier: row.wero_identifier,
    paymentMethods: row.payment_methods,
    paymentInstructionsEn: row.payment_instructions_en,
    paymentInstructionsFr: row.payment_instructions_fr,
    inAppAlerts: row.in_app_alerts ?? undefined,
    soundAlerts: row.sound_alerts ?? undefined,
  });
}

function mapPlaceOrderError(error: { code?: string; message?: string }): OrderRepoError {
  const msg = error.message || "";
  const code = error.code;
  switch (code) {
    case "P0001":
    case "P0003":
      return new OrderRepoError(msg, "STOCK_ERROR");
    case "P0004":
      return new OrderRepoError("This store is currently not accepting orders.", "STORE_CLOSED");
    case "P0005":
      return new OrderRepoError(msg, "MINIMUM_ORDER_UNMET");
    case "42501":
      return new OrderRepoError(msg, "UNAUTHORIZED");
    case "22023":
      return new OrderRepoError(msg, "INVALID_INPUT");
    default:
      if (msg.includes("INSUFFICIENT_STOCK") || msg.includes("PRODUCT_NOT_AVAILABLE")) {
        return new OrderRepoError(msg, "STOCK_ERROR");
      }
      return new OrderRepoError(
        msg || "We could not place your order. Please try again.",
        "INTERNAL_ERROR",
      );
  }
}

function mapCancelOrderError(error: { code?: string; message?: string }): OrderRepoError {
  const msg = error.message || "";
  const code = error.code;
  switch (code) {
    case "P0002":
      return new OrderRepoError("Order not found", "ORDER_NOT_FOUND");
    case "22023":
      return new OrderRepoError(msg, "INVALID_INPUT");
    case "42501":
      return new OrderRepoError("Permission denied", "UNAUTHORIZED");
    default:
      return new OrderRepoError(msg || "Failed to cancel order", "INTERNAL_ERROR");
  }
}

function mapMemberRow(row: Tables<"business_members">): BusinessMember {
  return businessMemberSchema.parse({
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    role: row.role,
    createdAt: toIsoUtc(row.created_at),
  });
}

const userMembershipQuerySchema = z.object({
  id: uuidSchema,
  business_id: uuidSchema,
  role: businessMemberRoleSchema,
  businesses: z
    .union([managerBusinessSummarySchema, z.array(managerBusinessSummarySchema).nonempty()])
    .nullable()
    .optional(),
});

export function createSupabaseRepositories(
  clientOrFactory?: SupabaseClientFactory,
  options?: SupabaseRepositoryOptions,
): Repositories {
  const getClient = async (): Promise<SupabaseClient<Database>> => {
    if (!clientOrFactory) {
      const { createClient } = await import("@/lib/supabase/server");
      return createClient();
    }
    if (typeof clientOrFactory === "function") {
      return clientOrFactory();
    }
    return clientOrFactory;
  };

  const products: ProductRepository = {
    async findById(businessId: string, id: string): Promise<Product | null> {
      const client = await getClient();
      const { data, error } = await client
        .from("products")
        .select()
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapProductRow(data);
    },

    async list(businessId: string, filter?: ProductFilter): Promise<Product[]> {
      const client = await getClient();
      let query = client.from("products").select().eq("business_id", businessId);

      if (filter?.categoryId) {
        query = query.eq("category_id", filter.categoryId);
      }
      if (filter?.visibleOnly) {
        query = query.eq("visible", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapProductRow);
    },

    async create(businessId: string, input: CreateProductInput): Promise<Product> {
      const client = await getClient();
      const now = new Date().toISOString();
      const insertData: TablesInsert<"products"> = {
        id: input.id ?? crypto.randomUUID(),
        business_id: businessId,
        category_id: input.categoryId,
        name: input.name,
        description: input.description ?? null,
        price: input.price,
        unit_cost: input.unitCost ?? 0,
        stock: input.stock ?? 0,
        visible: input.visible ?? true,
        allergens: [...(input.allergens ?? [])],
        suggest_add_ons: input.suggestAddOns ?? true,
        image_url: input.imageUrl ?? null,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await client.from("products").insert(insertData).select().single();
      if (error) throw error;
      return mapProductRow(data);
    },

    async update(businessId: string, id: string, input: UpdateProductInput): Promise<Product> {
      const client = await getClient();
      const updateData: TablesUpdate<"products"> = {};
      if (input.categoryId !== undefined) updateData.category_id = input.categoryId;
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.price !== undefined) updateData.price = input.price;
      if (input.unitCost !== undefined) updateData.unit_cost = input.unitCost;
      if (input.stock !== undefined) updateData.stock = input.stock;
      if (input.visible !== undefined) updateData.visible = input.visible;
      if (input.allergens !== undefined) updateData.allergens = [...input.allergens];
      if (input.suggestAddOns !== undefined) updateData.suggest_add_ons = input.suggestAddOns;
      if (input.imageUrl !== undefined) updateData.image_url = input.imageUrl;

      const { data, error } = await client
        .from("products")
        .update(updateData)
        .eq("business_id", businessId)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(`Product ${id} not found`);
      return mapProductRow(data);
    },

    async softDelete(businessId: string, id: string): Promise<Product> {
      return products.update(businessId, id, { visible: false });
    },
  };

  const categories: CategoryRepository = {
    async findById(businessId: string, id: string): Promise<ProductCategory | null> {
      const client = await getClient();
      const { data, error } = await client
        .from("product_categories")
        .select()
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapCategoryRow(data);
    },

    async list(businessId: string): Promise<ProductCategory[]> {
      const client = await getClient();
      const { data, error } = await client
        .from("product_categories")
        .select()
        .eq("business_id", businessId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data ?? []).map(mapCategoryRow);
    },

    async create(businessId: string, input: CreateCategoryInput): Promise<ProductCategory> {
      const client = await getClient();
      const now = new Date().toISOString();
      const insertData: TablesInsert<"product_categories"> = {
        id: input.id ?? crypto.randomUUID(),
        business_id: businessId,
        name: input.name,
        sort_order: input.sortOrder ?? 0,
        role: input.role ?? "regular",
        created_at: now,
      };

      const { data, error } = await client
        .from("product_categories")
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return mapCategoryRow(data);
    },

    async update(
      businessId: string,
      id: string,
      input: UpdateCategoryInput,
    ): Promise<ProductCategory> {
      const client = await getClient();
      const updateData: TablesUpdate<"product_categories"> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
      if (input.role !== undefined) updateData.role = input.role;

      const { data, error } = await client
        .from("product_categories")
        .update(updateData)
        .eq("business_id", businessId)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(`Category ${id} not found`);
      return mapCategoryRow(data);
    },

    async delete(businessId: string, id: string): Promise<void> {
      const client = await getClient();
      const { data, error } = await client
        .from("product_categories")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(`Category ${id} not found`);
    },
  };

  const orders: OrderRepository = {
    async sumQuantitiesByProduct(
      businessId: string,
      filter: ProductQuantityFilter,
    ): Promise<{ productId: string; quantity: number; lastOrderedAt: string }[]> {
      const client = await getClient();
      const { data, error } = await client
        .from("orders")
        .select("*, order_items(*)")
        .eq("business_id", businessId)
        .neq("status", "CANCELLED")
        .neq("paid", "refunded")
        .gte("created_at", filter.fromDate)
        .lte("created_at", filter.toDate);

      if (error) throw error;
      const mappedOrders = (data ?? []).map((row) => mapOrderRow(row as OrderRowWithItems));
      return sumOrderProductQuantities(mappedOrders, filter);
    },

    async findById(businessId: string, id: string): Promise<Order | null> {
      const client = await getClient();
      const { data, error } = await client
        .from("orders")
        .select("*, order_items(*)")
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapOrderRow(data as OrderRowWithItems);
    },

    async findByTrackingToken(trackingToken: string): Promise<PublicOrder | null> {
      const client = await getClient();
      const { data, error } = await client.rpc("get_order_by_tracking_token", {
        p_tracking_token: trackingToken,
      });

      if (error) throw error;
      if (!data) return null;

      const raw = data as {
        order?: Record<string, unknown>;
        items?: Array<Record<string, unknown>>;
      };
      if (!raw.order || Object.keys(raw.order).length === 0) return null;

      const order = raw.order as Record<string, unknown>;
      const items = Array.isArray(raw.items) ? raw.items : [];

      return publicOrderSchema.parse({
        businessId: order.business_id ?? order.businessId,
        orderNumber: order.order_number ?? order.orderNumber,
        serviceType: order.service_type ?? order.serviceType,
        status: order.status,
        paid: order.paid,
        paymentPreference: order.payment_preference ?? order.paymentPreference ?? "on_handover",
        requestedDate: order.requested_date ?? order.requestedDate,
        requestedTime: order.requested_time
          ? String(order.requested_time).slice(0, 5)
          : order.requestedTime
            ? String(order.requestedTime).slice(0, 5)
            : null,
        totalAmount: order.total_amount ?? order.totalAmount,
        cancellationReason: order.cancellation_reason ?? order.cancellationReason ?? null,
        createdAt: toIsoUtc(order.created_at ?? order.createdAt),
        items: items.map((it) => ({
          productName: it.product_name ?? it.productName,
          quantity: it.quantity,
          unitPrice: it.unit_price ?? it.unitPrice,
          totalPrice: it.total_price ?? it.totalPrice,
        })),
      });
    },

    async place(businessId: string, input: PlaceOrderRepoInput): Promise<PlacedOrderSummary> {
      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneNumber(input.guestPhone);
      } catch {
        normalizedPhone = input.guestPhone.trim();
      }

      const client = await getClient();
      const rpcItems = input.items.map((it) => ({
        product_id: it.productId,
        quantity: it.quantity,
      }));

      const { data, error } = await client.rpc("place_order", {
        p_business_id: businessId,
        p_guest_name: normalizeGuestName(input.guestName),
        p_guest_phone: normalizedPhone,
        p_service_type: input.serviceType,
        p_channel: input.channel,
        p_requested_date: input.requestedDate,
        p_items: rpcItems as unknown as Json,
        p_requested_time: input.requestedTime ?? undefined,
        p_payment_preference: input.paymentPreference ?? "on_handover",
        p_delivery_address: input.deliveryAddress ?? undefined,
        p_notes: input.notes ?? undefined,
        p_update_guest_name: input.allowRename ?? false,
      });

      if (error) {
        throw mapPlaceOrderError(error);
      }

      const res = data as {
        order_id: string;
        order_number: number;
        tracking_token: string;
        submitted_name?: string | null;
        total_amount: number;
      };

      return placedOrderSummarySchema.parse({
        orderId: res.order_id,
        orderNumber: res.order_number,
        trackingToken: res.tracking_token,
        submittedName: res.submitted_name ?? null,
        totalAmount: res.total_amount,
      });
    },

    async cancel(
      businessId: string,
      orderId: string,
      reason?: string | null,
    ): Promise<CancelOrderResult> {
      const client = await getClient();
      const { data, error } = await client.rpc("cancel_order", {
        p_business_id: businessId,
        p_order_id: orderId,
        p_cancellation_reason: reason ?? undefined,
      });

      if (error) {
        throw mapCancelOrderError(error);
      }

      const res = data as {
        order_id: string;
        status: OrderStatus;
        cancellation_reason?: string | null;
      };

      return cancelOrderResultSchema.parse({
        orderId: res.order_id,
        status: res.status,
        cancellationReason: res.cancellation_reason ?? null,
      });
    },

    async findTrackingTokenByTicketAndPhone(
      businessId: string,
      orderNumber: number,
      phone: string,
    ): Promise<string | null> {
      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneNumber(phone);
      } catch {
        return null;
      }

      const client = await getClient();
      const { data, error } = await client.rpc("storefront_order_tracking_token", {
        p_business_id: businessId,
        p_order_number: orderNumber,
        p_phone: normalizedPhone,
      });

      if (error) throw error;
      return (data as string | null) ?? null;
    },

    async list(businessId: string, filter?: OrderFilter): Promise<Order[]> {
      const client = await getClient();
      let query = client.from("orders").select("*, order_items(*)").eq("business_id", businessId);

      if (filter?.status) {
        query = query.eq("status", filter.status);
      }
      if (filter?.guestId) {
        query = query.eq("guest_id", filter.guestId);
      }
      if (filter?.fromDate) {
        query = query.gte("requested_date", filter.fromDate);
      }
      if (filter?.toDate) {
        query = query.lte("requested_date", filter.toDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => mapOrderRow(row as OrderRowWithItems));
    },

    async create(businessId: string, input: CreateOrderInput): Promise<Order> {
      const client = await getClient();

      let orderNumber = input.orderNumber;
      if (orderNumber === undefined) {
        const { data: maxOrder, error: maxError } = await client
          .from("orders")
          .select("order_number")
          .eq("business_id", businessId)
          .order("order_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (maxError) throw maxError;
        orderNumber = (maxOrder?.order_number ?? 0) + 1;
      }

      const paymentMethod =
        input.paid !== "unpaid" ? (input.paymentMethod ?? "cash") : (input.paymentMethod ?? null);
      const paidAt =
        input.paid !== "unpaid"
          ? (input.paidAt ?? new Date().toISOString())
          : (input.paidAt ?? null);

      const orderId = input.id ?? crypto.randomUUID();
      const now = new Date().toISOString();
      const defaultStatusHistory = [{ status: input.status, timestamp: now, note: null }];

      const insertOrderData: TablesInsert<"orders"> = {
        id: orderId,
        business_id: businessId,
        order_number: orderNumber,
        guest_id: input.guestId,
        submitted_name: input.submittedName ?? null,
        service_type: input.serviceType,
        channel: input.channel,
        status: input.status,
        paid: input.paid,
        payment_preference: input.paymentPreference,
        payment_method: paymentMethod,
        paid_at: paidAt,
        refunded_at: input.refundedAt ?? null,
        requested_date: input.requestedDate,
        requested_time: input.requestedTime ?? null,
        total_amount: input.totalAmount,
        tracking_token: input.trackingToken ?? crypto.randomUUID().replace(/-/g, ""),
        cancellation_reason: input.cancellationReason ?? null,
        notes: input.notes ?? null,
        delivery_address: input.deliveryAddress ?? null,
        status_history: (input.statusHistory ?? defaultStatusHistory) as Json,
        created_at: now,
        updated_at: now,
      };

      const { error: orderError } = await client.from("orders").insert(insertOrderData);
      if (orderError) throw orderError;

      const itemsToInsert: TablesInsert<"order_items">[] = input.items.map((it) => ({
        id: it.id ?? crypto.randomUUID(),
        order_id: orderId,
        business_id: businessId,
        product_id: it.productId,
        product_name: it.productName,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        total_price: it.totalPrice,
      }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await client.from("order_items").insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      const created = await orders.findById(businessId, orderId);
      if (!created) throw new Error(`Created order ${orderId} could not be retrieved`);
      return created;
    },

    async update(businessId: string, id: string, input: UpdateOrderInput): Promise<Order> {
      const client = await getClient();
      const updateData: TablesUpdate<"orders"> = {};
      if (input.orderNumber !== undefined) updateData.order_number = input.orderNumber;
      if (input.guestId !== undefined) updateData.guest_id = input.guestId;
      if (input.submittedName !== undefined) updateData.submitted_name = input.submittedName;
      if (input.serviceType !== undefined) updateData.service_type = input.serviceType;
      if (input.channel !== undefined) updateData.channel = input.channel;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.paid !== undefined) updateData.paid = input.paid;
      if (input.paymentPreference !== undefined)
        updateData.payment_preference = input.paymentPreference;
      if (input.paymentMethod !== undefined) updateData.payment_method = input.paymentMethod;
      if (input.paidAt !== undefined) updateData.paid_at = input.paidAt;
      if (input.refundedAt !== undefined) updateData.refunded_at = input.refundedAt;
      if (input.requestedDate !== undefined) updateData.requested_date = input.requestedDate;
      if (input.requestedTime !== undefined) updateData.requested_time = input.requestedTime;
      if (input.totalAmount !== undefined) updateData.total_amount = input.totalAmount;
      if (input.trackingToken !== undefined) updateData.tracking_token = input.trackingToken;
      if (input.cancellationReason !== undefined)
        updateData.cancellation_reason = input.cancellationReason;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.deliveryAddress !== undefined) updateData.delivery_address = input.deliveryAddress;
      if (input.statusHistory !== undefined)
        updateData.status_history = input.statusHistory as Json;

      if (input.paid && input.paid !== "unpaid") {
        if (updateData.payment_method === undefined) {
          updateData.payment_method = input.paymentMethod ?? "cash";
        }
        if (updateData.paid_at === undefined) {
          updateData.paid_at = input.paidAt ?? new Date().toISOString();
        }
      }

      const { data: updatedOrder, error: orderError } = await client
        .from("orders")
        .update(updateData)
        .eq("business_id", businessId)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (orderError) throw orderError;
      if (!updatedOrder) throw new Error(`Order ${id} not found`);

      if (input.items !== undefined) {
        const itemsToInsert = input.items.map((it) => ({
          id: it.id ?? crypto.randomUUID(),
          order_id: id,
          business_id: businessId,
          product_id: it.productId,
          product_name: it.productName,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          total_price: it.totalPrice,
        }));
        const { error: replaceError } = await client.rpc("replace_order_items", {
          p_business_id: businessId,
          p_order_id: id,
          p_items: itemsToInsert as unknown as Json,
        });
        if (replaceError) throw replaceError;
      }

      const fetched = await orders.findById(businessId, id);
      if (!fetched) throw new Error(`Order ${id} not found`);
      return fetched;
    },
  };

  const guests: GuestRepository = {
    async findById(businessId: string, id: string): Promise<Guest | null> {
      const client = await getClient();
      const { data, error } = await client
        .from("guests")
        .select()
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapGuestRow(data);
    },

    async findByPhone(businessId: string, phone: string): Promise<Guest | null> {
      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneNumber(phone);
      } catch {
        return null;
      }

      const client = await getClient();
      const { data, error } = await client
        .from("guests")
        .select()
        .eq("business_id", businessId)
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapGuestRow(data);
    },

    async list(businessId: string): Promise<Guest[]> {
      const client = await getClient();
      const { data, error } = await client.from("guests").select().eq("business_id", businessId);

      if (error) throw error;
      return (data ?? []).map(mapGuestRow);
    },

    async create(businessId: string, input: CreateGuestInput): Promise<Guest> {
      const client = await getClient();
      let phone: string | null = null;
      if (input.phone) {
        phone = normalizePhoneNumber(input.phone);
        const existing = await guests.findByPhone(businessId, phone);
        if (existing) {
          throw new Error("A guest with this phone number already exists");
        }
      }

      const now = new Date().toISOString();
      const insertData: TablesInsert<"guests"> = {
        id: input.id ?? crypto.randomUUID(),
        business_id: businessId,
        name: normalizeGuestName(input.name),
        phone,
        email: input.email ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        created_at: now,
      };

      const { data, error } = await client.from("guests").insert(insertData).select().single();
      if (error) {
        if (
          error.code === "23505" ||
          error.message?.includes("unique") ||
          error.message?.includes("already exists")
        ) {
          throw new Error("A guest with this phone number already exists");
        }
        throw error;
      }
      return mapGuestRow(data);
    },

    async update(businessId: string, id: string, input: UpdateGuestInput): Promise<Guest> {
      const existing = await guests.findById(businessId, id);
      if (!existing) {
        throw new Error(`Guest ${id} not found`);
      }

      let phone = existing.phone;
      if (input.phone !== undefined) {
        phone = input.phone ? normalizePhoneNumber(input.phone) : null;
        if (phone && phone !== existing.phone) {
          const duplicate = await guests.findByPhone(businessId, phone);
          if (duplicate && duplicate.id !== id) {
            throw new Error("A guest with this phone number already exists");
          }
        }
      }

      const name = input.name !== undefined ? normalizeGuestName(input.name) : existing.name;
      const updateData: TablesUpdate<"guests"> = {
        name,
        phone,
      };
      if (input.email !== undefined) updateData.email = input.email ?? null;
      if (input.address !== undefined) updateData.address = input.address ?? null;
      if (input.notes !== undefined) updateData.notes = input.notes ?? null;

      const client = await getClient();
      const { data, error } = await client
        .from("guests")
        .update(updateData)
        .eq("business_id", businessId)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        if (
          error.code === "23505" ||
          error.message?.includes("unique") ||
          error.message?.includes("already exists")
        ) {
          throw new Error("A guest with this phone number already exists");
        }
        throw error;
      }
      if (!data) {
        throw new Error(`Guest ${id} not found`);
      }
      return mapGuestRow(data);
    },
  };

  const expenses: ExpenseRepository = {
    async findById(businessId: string, id: string): Promise<Expense | null> {
      const client = await getClient();
      const { data, error } = await client
        .from("expenses")
        .select()
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapExpenseRow(data);
    },

    async list(businessId: string, filter?: ExpenseFilter): Promise<Expense[]> {
      const client = await getClient();
      let query = client.from("expenses").select().eq("business_id", businessId);

      if (filter?.tag) {
        query = query.contains("tags", [filter.tag]);
      }
      if (filter?.fromDate) {
        query = query.gte("date", filter.fromDate);
      }
      if (filter?.toDate) {
        query = query.lte("date", filter.toDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapExpenseRow);
    },

    async create(businessId: string, input: CreateExpenseInput): Promise<Expense> {
      const client = await getClient();
      const now = new Date().toISOString();
      const insertData: TablesInsert<"expenses"> = {
        id: input.id ?? crypto.randomUUID(),
        business_id: businessId,
        amount: input.amount,
        date: input.date,
        description: input.description,
        tags: input.tags ? [...input.tags] : [],
        created_at: now,
      };

      const { data, error } = await client.from("expenses").insert(insertData).select().single();
      if (error) throw error;
      return mapExpenseRow(data);
    },

    async update(businessId: string, id: string, input: UpdateExpenseInput): Promise<Expense> {
      const client = await getClient();
      const updateData: TablesUpdate<"expenses"> = {};
      if (input.amount !== undefined) updateData.amount = input.amount;
      if (input.date !== undefined) updateData.date = input.date;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.tags !== undefined) updateData.tags = [...input.tags];

      const { data, error } = await client
        .from("expenses")
        .update(updateData)
        .eq("business_id", businessId)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(`Expense ${id} not found`);
      return mapExpenseRow(data);
    },

    async delete(businessId: string, id: string): Promise<void> {
      const client = await getClient();
      const { data, error } = await client
        .from("expenses")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(`Expense ${id} not found`);
    },
  };

  const business: BusinessRepository = {
    async findById(id: string): Promise<Business | null> {
      const client = await getClient();
      const { data, error } = await client.from("businesses").select().eq("id", id).maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapBusinessRow(data);
    },

    async findBySlug(slug: string): Promise<Business | null> {
      const client = await getClient();
      const { data, error } = await client
        .from("businesses")
        .select()
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapBusinessRow(data);
    },

    async create(input: CreateBusinessInput): Promise<Business> {
      const client = await getClient();
      const businessId = input.id ?? crypto.randomUUID();
      const now = new Date().toISOString();

      const insertData: TablesInsert<"businesses"> = {
        id: businessId,
        name: input.name,
        slug: input.slug,
        currency: input.currency ?? "EUR",
        description: input.description ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        whatsapp_number: input.whatsappNumber ?? null,
        instagram_url: input.instagramUrl ?? null,
        facebook_url: input.facebookUrl ?? null,
        tiktok_url: input.tiktokUrl ?? null,
        address: input.address ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        logo_url: input.logoUrl ?? null,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await client.from("businesses").insert(insertData).select().single();
      if (error) throw error;

      const { error: settingsError } = await client.from("business_settings").insert({
        business_id: businessId,
      });
      if (settingsError) throw settingsError;

      return mapBusinessRow(data);
    },

    async update(id: string, input: UpdateBusinessInput): Promise<Business> {
      const client = await getClient();
      const updateData: TablesUpdate<"businesses"> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.slug !== undefined) updateData.slug = input.slug;
      if (input.currency !== undefined) updateData.currency = input.currency;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.whatsappNumber !== undefined) updateData.whatsapp_number = input.whatsappNumber;
      if (input.instagramUrl !== undefined) updateData.instagram_url = input.instagramUrl;
      if (input.facebookUrl !== undefined) updateData.facebook_url = input.facebookUrl;
      if (input.tiktokUrl !== undefined) updateData.tiktok_url = input.tiktokUrl;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.latitude !== undefined) updateData.latitude = input.latitude;
      if (input.longitude !== undefined) updateData.longitude = input.longitude;
      if (input.logoUrl !== undefined) updateData.logo_url = input.logoUrl;

      const { data, error } = await client
        .from("businesses")
        .update(updateData)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(`Business ${id} not found`);
      return mapBusinessRow(data);
    },

    async getSettings(businessId: string): Promise<BusinessSettings | null> {
      const client = await getClient();
      const query = options?.publicOnly
        ? client.from("business_settings").select(PUBLIC_BUSINESS_SETTINGS_COLUMNS)
        : client.from("business_settings").select();

      const { data, error } = await query.eq("business_id", businessId).maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapSettingsRow(data as Partial<Tables<"business_settings">>);
    },

    async updateSettings(
      businessId: string,
      input: UpdateSettingsInput,
    ): Promise<BusinessSettings> {
      const client = await getClient();
      const updateData: TablesUpdate<"business_settings"> = {};
      if (input.currency !== undefined) updateData.currency = input.currency;
      if (input.dateFormat !== undefined) updateData.date_format = input.dateFormat;
      if (input.lowStockThreshold !== undefined)
        updateData.low_stock_threshold = input.lowStockThreshold;
      if (input.taxPercentage !== undefined) updateData.tax_percentage = input.taxPercentage;
      if (input.notifications !== undefined) updateData.notifications = input.notifications;
      if (input.acceptingOrders !== undefined) updateData.accepting_orders = input.acceptingOrders;
      if (input.serviceTypes !== undefined) updateData.service_types = input.serviceTypes as Json;
      if (input.openingHours !== undefined) updateData.opening_hours = input.openingHours;
      if (input.orderTimingAsap !== undefined) updateData.order_timing_asap = input.orderTimingAsap;
      if (input.orderTimingScheduled !== undefined)
        updateData.order_timing_scheduled = input.orderTimingScheduled;
      if (input.orderTimingTimeOptional !== undefined)
        updateData.order_timing_time_optional = input.orderTimingTimeOptional;
      if (input.deliveryFee !== undefined) updateData.delivery_fee = input.deliveryFee;
      if (input.minOrderAmount !== undefined) updateData.min_order_amount = input.minOrderAmount;
      if (input.leadTimeValue !== undefined) updateData.lead_time_value = input.leadTimeValue;
      if (input.leadTimeUnit !== undefined) updateData.lead_time_unit = input.leadTimeUnit;
      if (input.revolutRevtag !== undefined) updateData.revolut_revtag = input.revolutRevtag;
      if (input.weroIdentifier !== undefined) updateData.wero_identifier = input.weroIdentifier;
      if (input.paymentMethods !== undefined)
        updateData.payment_methods = input.paymentMethods as Json;
      if (input.paymentInstructionsEn !== undefined)
        updateData.payment_instructions_en = input.paymentInstructionsEn;
      if (input.paymentInstructionsFr !== undefined)
        updateData.payment_instructions_fr = input.paymentInstructionsFr;
      if (input.inAppAlerts !== undefined) updateData.in_app_alerts = input.inAppAlerts;
      if (input.soundAlerts !== undefined) updateData.sound_alerts = input.soundAlerts;

      const { data, error } = await client
        .from("business_settings")
        .update(updateData)
        .eq("business_id", businessId)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(`Settings for business ${businessId} not found`);
      return mapSettingsRow(data);
    },
  };

  const members: MemberRepository = {
    async list(businessId: string): Promise<BusinessMember[]> {
      const client = await getClient();
      const { data, error } = await client
        .from("business_members")
        .select()
        .eq("business_id", businessId);

      if (error) throw error;
      return (data ?? []).map(mapMemberRow);
    },

    async findById(businessId: string, id: string): Promise<BusinessMember | null> {
      const client = await getClient();
      const { data, error } = await client
        .from("business_members")
        .select()
        .eq("business_id", businessId)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapMemberRow(data);
    },

    async findByUserId(businessId: string, userId: string): Promise<BusinessMember | null> {
      const client = await getClient();
      const { data, error } = await client
        .from("business_members")
        .select()
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapMemberRow(data);
    },

    async findMembershipForUser(userId: string): Promise<UserMembershipSummary | null> {
      const client = await getClient();
      // Single-business-per-user assumption: FoodBiz currently models exactly one active business per manager.
      // If a user has multiple memberships, deterministic ordering (created_at asc, id asc, limit 1) ensures
      // the earliest created membership is returned.
      const { data, error } = await client
        .from("business_members")
        .select("id, business_id, role, created_at, businesses(id, name, slug, currency)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const parsed = userMembershipQuerySchema.parse(data);

      let businessSummary = Array.isArray(parsed.businesses)
        ? parsed.businesses[0]
        : (parsed.businesses ?? null);

      if (!businessSummary) {
        const { data: directBusiness, error: bizError } = await client
          .from("businesses")
          .select("id, name, slug, currency")
          .eq("id", parsed.business_id)
          .maybeSingle();

        if (bizError) throw bizError;
        if (!directBusiness) return null;
        businessSummary = managerBusinessSummarySchema.parse(directBusiness);
      }

      return {
        member: {
          id: parsed.id,
          businessId: parsed.business_id,
          role: parsed.role,
        },
        business: {
          id: businessSummary.id,
          name: businessSummary.name,
          slug: businessSummary.slug,
          currency: businessSummary.currency,
        },
      };
    },

    async add(businessId: string, input: CreateMemberInput): Promise<BusinessMember> {
      const client = await getClient();
      const now = new Date().toISOString();
      const insertData: TablesInsert<"business_members"> = {
        id: input.id ?? crypto.randomUUID(),
        business_id: businessId,
        user_id: input.userId,
        role: input.role,
        created_at: now,
      };

      const { data, error } = await client
        .from("business_members")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return mapMemberRow(data);
    },

    async updateRole(
      businessId: string,
      id: string,
      role: BusinessMemberRole,
    ): Promise<BusinessMember> {
      const client = await getClient();
      const { data, error } = await client
        .from("business_members")
        .update({ role })
        .eq("business_id", businessId)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(`Member ${id} not found`);
      return mapMemberRow(data);
    },

    async remove(businessId: string, id: string): Promise<void> {
      const client = await getClient();
      const { data, error } = await client
        .from("business_members")
        .delete()
        .eq("business_id", businessId)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(`Member ${id} not found`);
    },
  };

  return { products, categories, orders, guests, expenses, business, members };
}
