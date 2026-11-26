// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { featuredDateRange } from "@/domain/featured";
import { OrderRepoError, type PlacedOrderSummary } from "@/domain/order";
import type { Repositories } from "@/domain/repositories";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseRepositories } from "../supabase";
import { describeOrderPlacementContract, describeOrderStateContract } from "./contracts";

const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;

const hasLiveSupabase = Boolean(url && serviceKey && anonKey);

// In CI, missing environment variables must fail rather than silently skipping (Task 2 / H5).
// Locally without a running Supabase container, the suite is cleanly skipped with an actionable guide.
const shouldSkip = !hasLiveSupabase && !process.env.CI;

if (shouldSkip) {
  console.warn(
    "[supabase-live.contract.test.ts] Skipping live Supabase contract suite: SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY, or SUPABASE_TEST_ANON_KEY not set.\n" +
      "To run this suite locally:\n" +
      "  1. npm run db:start\n" +
      "  2. eval $(supabase status -o env | grep -E '^[A-Z0-9_]+=')\n" +
      '  3. SUPABASE_TEST_URL="$API_URL" SUPABASE_TEST_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" SUPABASE_TEST_ANON_KEY="$ANON_KEY" npm run test:live\n',
  );
}

describe.skipIf(shouldSkip)("Supabase Live Security & Concurrency Contract Suite", () => {
  let adminClient: SupabaseClient<Database>;
  let anonClient: SupabaseClient<Database>;
  let memberAClient: SupabaseClient<Database>;
  let memberBClient: SupabaseClient<Database>;
  let ownerAClient: SupabaseClient<Database>;
  let staffAClient: SupabaseClient<Database>;
  let nonMemberClient: SupabaseClient<Database>;

  let anonRepos: Repositories;
  let anonPublicRepos: Repositories;
  let memberARepos: Repositories;
  let memberBRepos: Repositories;
  let ownerARepos: Repositories;
  let staffARepos: Repositories;
  let nonMemberRepos: Repositories;

  const runId = crypto.randomUUID().slice(0, 8);
  const businessAId = crypto.randomUUID();
  const businessBId = crypto.randomUUID();
  const slugA = `tenant-a-${runId}`;
  const slugB = `tenant-b-${runId}`;

  const memberAEmail = `member-a-${runId}@example.com`;
  const memberBEmail = `member-b-${runId}@example.com`;
  const nonMemberEmail = `nonmember-${runId}@example.com`;
  const ownerAEmail = `owner-a-${runId}@example.com`;
  const staffAEmail = `staff-a-${runId}@example.com`;
  const testPassword = "Password123!";

  let userAId = "";
  let userBId = "";
  let nonMemberUserId = "";
  let ownerAUserId = "";
  let staffAUserId = "";

  let catAId = "";
  let catBId = "";
  let prodAVisibleId = "";
  let prodAHiddenId = "";
  let prodALowStockId = "";
  let prodAStock2Id = "";
  let prodABulkId = "";
  let prodBId = "";
  let prodBHiddenId = "";

  let trackedOrder: PlacedOrderSummary | null = null;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  beforeAll(async () => {
    if (process.env.CI && (!url || !serviceKey || !anonKey)) {
      throw new Error(
        "Missing SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY, or SUPABASE_TEST_ANON_KEY in CI environment.",
      );
    }
    if (!url || !serviceKey || !anonKey) {
      return;
    }

    // 1. Service-role client for fixture setup/teardown only (H5)
    adminClient = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Create auth users with verified email
    const resA = await adminClient.auth.admin.createUser({
      email: memberAEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (resA.error || !resA.data.user) {
      throw new Error(`Failed to create member user A: ${resA.error?.message}`);
    }
    userAId = resA.data.user.id;

    const resB = await adminClient.auth.admin.createUser({
      email: memberBEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (resB.error || !resB.data.user) {
      throw new Error(`Failed to create member user B: ${resB.error?.message}`);
    }
    userBId = resB.data.user.id;

    const resNM = await adminClient.auth.admin.createUser({
      email: nonMemberEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (resNM.error || !resNM.data.user) {
      throw new Error(`Failed to create non-member user: ${resNM.error?.message}`);
    }
    nonMemberUserId = resNM.data.user.id;

    for (const [email, assign] of [
      [ownerAEmail, (id: string) => (ownerAUserId = id)],
      [staffAEmail, (id: string) => (staffAUserId = id)],
    ] as const) {
      const res = await adminClient.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true,
      });
      if (res.error || !res.data.user) {
        throw new Error(`Failed to create user ${email}: ${res.error?.message}`);
      }
      assign(res.data.user.id);
    }

    // 3. Seed two distinct tenant businesses with isolated settings
    const { error: errBiz } = await adminClient.from("businesses").insert([
      {
        id: businessAId,
        name: `Tenant A Kitchen ${runId}`,
        slug: slugA,
        currency: "EUR",
      },
      {
        id: businessBId,
        name: `Tenant B Bistro ${runId}`,
        slug: slugB,
        currency: "EUR",
      },
    ]);
    if (errBiz) throw new Error(`Failed to insert businesses: ${errBiz.message}`);

    const { error: errSettings } = await adminClient.from("business_settings").insert([
      {
        id: crypto.randomUUID(),
        business_id: businessAId,
        currency: "EUR",
        accepting_orders: true,
        min_order_amount: 500, // 5.00 EUR
        delivery_fee: 200, // 2.00 EUR
        service_types: { pickup: true, delivery: true, dineIn: true },
        payment_methods: { cash: true, card: false, revolut: true, wero: true },
        low_stock_threshold: 5,
        tax_percentage: 10,
        notifications: true,
        in_app_alerts: true,
        sound_alerts: true,
      },
      {
        id: crypto.randomUUID(),
        business_id: businessBId,
        currency: "EUR",
        accepting_orders: true,
        min_order_amount: 500,
        delivery_fee: 200,
        service_types: { pickup: true, delivery: false, dineIn: false },
        payment_methods: { cash: true },
        low_stock_threshold: 3,
        tax_percentage: 20,
        notifications: false,
        in_app_alerts: false,
        sound_alerts: false,
      },
    ]);
    if (errSettings) throw new Error(`Failed to insert business settings: ${errSettings.message}`);

    const { error: errMembers } = await adminClient.from("business_members").insert([
      {
        id: crypto.randomUUID(),
        business_id: businessAId,
        user_id: userAId,
        role: "manager",
      },
      {
        id: crypto.randomUUID(),
        business_id: businessBId,
        user_id: userBId,
        role: "manager",
      },
      {
        id: crypto.randomUUID(),
        business_id: businessAId,
        user_id: ownerAUserId,
        role: "owner",
      },
      {
        id: crypto.randomUUID(),
        business_id: businessAId,
        user_id: staffAUserId,
        role: "staff",
      },
    ]);
    if (errMembers) throw new Error(`Failed to insert business members: ${errMembers.message}`);

    catAId = crypto.randomUUID();
    catBId = crypto.randomUUID();
    const { error: errCats } = await adminClient.from("product_categories").insert([
      {
        id: catAId,
        business_id: businessAId,
        name: "Artisan Breads",
        sort_order: 1,
        role: "regular",
      },
      {
        id: catBId,
        business_id: businessBId,
        name: "Main Dishes",
        sort_order: 1,
        role: "regular",
      },
    ]);
    if (errCats) throw new Error(`Failed to insert product categories: ${errCats.message}`);

    prodAVisibleId = crypto.randomUUID();
    prodAHiddenId = crypto.randomUUID();
    prodALowStockId = crypto.randomUUID();
    prodAStock2Id = crypto.randomUUID();
    prodABulkId = crypto.randomUUID();
    prodBId = crypto.randomUUID();
    prodBHiddenId = crypto.randomUUID();

    const { error: errProds } = await adminClient.from("products").insert([
      {
        id: prodAVisibleId,
        business_id: businessAId,
        category_id: catAId,
        name: "Poulet Braisé",
        description: "Charcoal-grilled chicken",
        price: 1000,
        unit_cost: 200,
        stock: 20,
        visible: true,
        allergens: ["gluten"],
        suggest_add_ons: false,
      },
      {
        id: prodAHiddenId,
        business_id: businessAId,
        category_id: catAId,
        name: "Secret Recipe Brioche",
        description: "Hidden from storefront",
        price: 1200,
        unit_cost: 300,
        stock: 5,
        visible: false,
        allergens: ["gluten"],
        suggest_add_ons: false,
      },
      {
        id: prodALowStockId,
        business_id: businessAId,
        category_id: catAId,
        name: "Last Artisanal Loaf",
        description: "Exactly one left for concurrency tests",
        price: 1000,
        unit_cost: 250,
        stock: 1,
        visible: true,
        allergens: ["gluten"],
        suggest_add_ons: false,
      },
      {
        id: prodAStock2Id,
        business_id: businessAId,
        category_id: catAId,
        name: "Pain au Chocolat Duo",
        description: "Exactly two left for N=5 concurrency test",
        price: 1000,
        unit_cost: 250,
        stock: 2,
        visible: true,
        allergens: ["gluten"],
        suggest_add_ons: false,
      },
      {
        id: prodABulkId,
        business_id: businessAId,
        category_id: catAId,
        name: "Bulk Roll",
        description: "Plenty of stock for the place_order limit boundaries",
        price: 100,
        unit_cost: 40,
        stock: 1000,
        visible: true,
        allergens: ["gluten"],
        suggest_add_ons: false,
      },
      {
        id: prodBId,
        business_id: businessBId,
        category_id: catBId,
        name: "Tenant B Special Quiche",
        description: "Tenant B product",
        price: 800,
        unit_cost: 200,
        stock: 10,
        visible: true,
        allergens: ["milk"],
        suggest_add_ons: false,
      },
      {
        id: prodBHiddenId,
        business_id: businessBId,
        category_id: catBId,
        name: "Tenant B Hidden Special",
        description: "Hidden product for member-only access",
        price: 900,
        unit_cost: 250,
        stock: 5,
        visible: false,
        allergens: ["milk"],
        suggest_add_ons: false,
      },
    ]);
    if (errProds) throw new Error(`Failed to insert products: ${errProds.message}`);

    // 4. Initialize real anon and authenticated member clients
    anonClient = createClient<Database>(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    memberAClient = createClient<Database>(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: errAuthA } = await memberAClient.auth.signInWithPassword({
      email: memberAEmail,
      password: testPassword,
    });
    if (errAuthA) throw new Error(`Member A sign in failed: ${errAuthA.message}`);

    memberBClient = createClient<Database>(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: errAuthB } = await memberBClient.auth.signInWithPassword({
      email: memberBEmail,
      password: testPassword,
    });
    if (errAuthB) throw new Error(`Member B sign in failed: ${errAuthB.message}`);

    ownerAClient = createClient<Database>(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: errAuthOwnerA } = await ownerAClient.auth.signInWithPassword({
      email: ownerAEmail,
      password: testPassword,
    });
    if (errAuthOwnerA) throw new Error(`Owner A sign in failed: ${errAuthOwnerA.message}`);

    staffAClient = createClient<Database>(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: errAuthStaffA } = await staffAClient.auth.signInWithPassword({
      email: staffAEmail,
      password: testPassword,
    });
    if (errAuthStaffA) throw new Error(`Staff A sign in failed: ${errAuthStaffA.message}`);

    nonMemberClient = createClient<Database>(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: errAuthNM } = await nonMemberClient.auth.signInWithPassword({
      email: nonMemberEmail,
      password: testPassword,
    });
    if (errAuthNM) throw new Error(`Non-member sign in failed: ${errAuthNM.message}`);

    anonRepos = createSupabaseRepositories(anonClient);
    anonPublicRepos = createSupabaseRepositories(anonClient, { publicOnly: true });
    memberARepos = createSupabaseRepositories(memberAClient);
    memberBRepos = createSupabaseRepositories(memberBClient);
    ownerARepos = createSupabaseRepositories(ownerAClient);
    staffARepos = createSupabaseRepositories(staffAClient);
    nonMemberRepos = createSupabaseRepositories(nonMemberClient);
  });

  afterAll(async () => {
    if (!adminClient) return;
    const businessIds = [businessAId, businessBId];

    await adminClient.from("order_items").delete().in("business_id", businessIds);
    await adminClient.from("orders").delete().in("business_id", businessIds);
    await adminClient.from("expenses").delete().in("business_id", businessIds);
    await adminClient.from("guests").delete().in("business_id", businessIds);
    await adminClient.from("products").delete().in("business_id", businessIds);
    await adminClient.from("product_categories").delete().in("business_id", businessIds);
    await adminClient.from("business_members").delete().in("business_id", businessIds);
    await adminClient.from("business_settings").delete().in("business_id", businessIds);
    await adminClient.from("businesses").delete().in("id", businessIds);

    for (const uid of [userAId, userBId, nonMemberUserId, ownerAUserId, staffAUserId]) {
      if (uid) {
        await adminClient.auth.admin.deleteUser(uid).catch(() => {});
      }
    }
  });

  // The database enforces these limits inside place_order for anonymous callers (direct RPC use
  // bypasses the app). The numbers come from src/domain/anti-abuse.ts, so this fails when the
  // SQL constants and the domain constants diverge.
  describeOrderPlacementContract(() => anonPublicRepos, businessAId, {
    boundaryProductId: () => prodABulkId,
  });

  // Lifecycle transitions (every pair against the domain table), payments, refunds and item
  // replacement, as the owner of business A (refunds are owner-only) with a manager as the non-owner.
  describeOrderStateContract(
    () => ownerARepos,
    businessAId,
    () => memberARepos,
  );

  describe("Anonymous Storefront Boundary (RLS & place_order RPC)", () => {
    it("anon orders.place succeeds for visible product via storefront channel", async () => {
      const res = await anonRepos.orders.place(businessAId, {
        guestName: "Marie Curie",
        guestPhone: "+33612345678",
        serviceType: "pickup",
        channel: "storefront",
        requestedDate: tomorrow,
        items: [{ productId: prodAVisibleId, quantity: 2 }],
      });

      expect(res.orderId).toBeDefined();
      expect(res.orderNumber).toBeGreaterThan(0);
      expect(res.totalAmount).toBe(2000);
      expect(res.trackingToken).toBeDefined();
      trackedOrder = res;

      // Verify stock was atomically decremented from 20 to 18
      const { data: p } = await adminClient
        .from("products")
        .select("stock")
        .eq("id", prodAVisibleId)
        .single();
      expect(p?.stock).toBe(18);
    });

    it("anon orders.place is rejected for hidden products (PRODUCT_NOT_AVAILABLE)", async () => {
      await expect(
        anonRepos.orders.place(businessAId, {
          guestName: "Marie Curie",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: tomorrow,
          items: [{ productId: prodAHiddenId, quantity: 1 }],
        }),
      ).rejects.toThrow();
    });

    it("anon orders.place is rejected for privileged channels (UNAUTHORIZED)", async () => {
      await expect(
        anonRepos.orders.place(businessAId, {
          guestName: "Marie Curie",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "phone",
          requestedDate: tomorrow,
          items: [{ productId: prodAVisibleId, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("anon orders.place is rejected when stock is insufficient (STOCK_ERROR)", async () => {
      await expect(
        anonRepos.orders.place(businessAId, {
          guestName: "Marie Curie",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: tomorrow,
          items: [{ productId: prodAVisibleId, quantity: 50 }], // above the stock (20), within the per-line cap
        }),
      ).rejects.toMatchObject({ code: "STOCK_ERROR" });
    });

    it("anon cannot list orders, guests, or expenses under RLS", async () => {
      const orders = await anonRepos.orders.list(businessAId);
      expect(orders).toEqual([]);

      const guests = await anonRepos.guests.list(businessAId);
      expect(guests).toEqual([]);

      const expenses = await anonRepos.expenses.list(businessAId);
      expect(expenses).toEqual([]);
    });

    it("anon orders.findByTrackingToken returns the placed order", async () => {
      expect(trackedOrder).not.toBeNull();
      const order = await anonRepos.orders.findByTrackingToken(trackedOrder!.trackingToken);
      expect(order).not.toBeNull();
      expect(order?.orderNumber).toBe(trackedOrder!.orderNumber);
      expect(order?.totalAmount).toBe(trackedOrder!.totalAmount);
      expect(order?.items.length).toBe(1);
      expect(order?.items[0].quantity).toBe(2);
    });

    it("anon orders.findTrackingTokenByTicketAndPhone returns token for exact ticket and phone match", async () => {
      expect(trackedOrder).not.toBeNull();
      const token = await anonRepos.orders.findTrackingTokenByTicketAndPhone(
        businessAId,
        trackedOrder!.orderNumber,
        "+33612345678",
      );
      expect(token).toBe(trackedOrder!.trackingToken);

      const wrongPhone = await anonRepos.orders.findTrackingTokenByTicketAndPhone(
        businessAId,
        trackedOrder!.orderNumber,
        "+33600000000",
      );
      expect(wrongPhone).toBeNull();
    });

    it("anon settings read works with publicOnly and fails when requesting private columns", async () => {
      // 1. With publicOnly: true, queries storefront-permitted columns successfully
      const publicSettings = await anonPublicRepos.business.getSettings(businessAId);
      expect(publicSettings).not.toBeNull();
      expect(publicSettings?.currency).toBe("EUR");
      expect(publicSettings?.acceptingOrders).toBe(true);
      expect(publicSettings?.weeklyHours).toBeNull();
      expect(publicSettings?.timezone).toBe("Europe/Paris");

      // Manager updates weeklyHours, anon public storefront reads it, manager clears it back to null
      const schedule = {
        mon: [],
        tue: [{ open: "11:30", close: "14:30" }],
        wed: [],
        thu: [],
        fri: [{ open: "18:00", close: "24:00" }],
        sat: [{ open: "00:00", close: "01:00" }],
        sun: [],
      };
      const updated = await memberARepos.business.updateSettings(businessAId, {
        weeklyHours: schedule,
      });
      expect(updated.weeklyHours).toEqual(schedule);
      const anonWithHours = await anonPublicRepos.business.getSettings(businessAId);
      expect(anonWithHours?.weeklyHours).toEqual(schedule);
      const cleared = await memberARepos.business.updateSettings(businessAId, {
        weeklyHours: null,
      });
      expect(cleared.weeklyHours).toBeNull();

      // 2. Without publicOnly (select * on business_settings), column-level grant revokes private columns for anon
      await expect(anonRepos.business.getSettings(businessAId)).rejects.toThrow();
    });

    it("anon public product reads select only public columns and never expose unit cost", async () => {
      const list = await anonPublicRepos.products.list(businessAId, { visibleOnly: true });
      expect(list.some((p) => p.id === prodAVisibleId)).toBe(true);
      expect(list.every((p) => p.unitCost === 0)).toBe(true);
      const one = await anonPublicRepos.products.findById(businessAId, prodAVisibleId);
      expect(one?.id).toBe(prodAVisibleId);
      expect(one?.unitCost).toBe(0);
    });

    it("anon direct PostgREST reads cannot select unit_cost or every column of products", async () => {
      const unitCost = await anonClient.from("products").select("unit_cost");
      expect(unitCost.error?.code).toBe("42501");
      const everything = await anonClient.from("products").select("*");
      expect(everything.error?.code).toBe("42501");
      const granted = await anonClient
        .from("products")
        .select("id, business_id, category_id, name, description, price, stock, visible")
        .eq("business_id", businessAId);
      expect(granted.error).toBeNull();
      expect(granted.data?.length).toBeGreaterThan(0);
    });

    it("a non-member authenticated user cannot read another tenant's products or their unit_cost", async () => {
      const { data, error } = await nonMemberClient
        .from("products")
        .select("id, unit_cost")
        .eq("business_id", businessAId);
      expect(error).toBeNull();
      expect(data).toEqual([]);
      const own = await memberAClient
        .from("products")
        .select("unit_cost")
        .eq("id", prodAVisibleId)
        .single();
      expect(own.data?.unit_cost).toBe(200);
    });

    it("anon direct get_order_by_tracking_token returns only the explicit item keys", async () => {
      const { data: placed, error: placeError } = await anonClient.rpc("place_order", {
        p_business_id: businessAId,
        p_guest_name: "Payload Checker",
        p_guest_phone: `+3367${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
        p_service_type: "pickup",
        p_channel: "storefront",
        p_requested_date: tomorrow,
        p_items: [{ product_id: prodABulkId, quantity: 5 }],
      });
      expect(placeError).toBeNull();
      const token = (placed as { tracking_token: string }).tracking_token;
      const { data } = await anonClient.rpc("get_order_by_tracking_token", {
        p_tracking_token: token,
      });
      const items = (data as { items: Array<Record<string, unknown>> }).items;
      expect(Object.keys(items[0]).toSorted()).toEqual([
        "product_name",
        "quantity",
        "total_price",
        "unit_price",
      ]);
    });

    it("anon featured products come from the storefront_featured_products function", async () => {
      // Orders are not readable by anon, so the aggregate must come from the SECURITY DEFINER function.
      const totals = await anonPublicRepos.orders.sumQuantitiesByProduct(
        businessAId,
        featuredDateRange(new Date(), 7),
      );
      const row = totals.find((t) => t.productId === prodAVisibleId);
      expect(row?.quantity).toBeGreaterThanOrEqual(2);
      expect(
        totals.every(
          (t) => Object.keys(t).toSorted().join() === "lastOrderedAt,productId,quantity",
        ),
      ).toBe(true);
      expect(totals.some((t) => t.productId === prodAHiddenId)).toBe(false);

      // The 30-day window is accepted too, and another tenant's id yields no rows.
      await expect(
        anonPublicRepos.orders.sumQuantitiesByProduct(
          businessAId,
          featuredDateRange(new Date(), 30),
        ),
      ).resolves.toEqual(expect.any(Array));
      await expect(
        anonPublicRepos.orders.sumQuantitiesByProduct(
          crypto.randomUUID(),
          featuredDateRange(new Date(), 7),
        ),
      ).resolves.toEqual([]);
    });

    it("anon orders.place maps database failures to generic codes without leaking database text", async () => {
      const failure = await anonRepos.orders
        .place(businessAId, {
          guestName: "Marie Curie",
          guestPhone: "+33612345678",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: tomorrow,
          items: [{ productId: prodAHiddenId, quantity: 1 }],
        })
        .catch((err: unknown) => err);
      expect(failure).toBeInstanceOf(OrderRepoError);
      expect((failure as OrderRepoError).code).toBe("STOCK_ERROR");
      expect((failure as OrderRepoError).message).not.toMatch(
        /PRODUCT_NOT_AVAILABLE|[0-9a-f]{8}-[0-9a-f]{4}/,
      );
    });
  });

  describe("Authenticated Member CRUD & Cross-Tenant Security Isolation", () => {
    it("member A can perform CRUD operations on their own tenant resources", async () => {
      // Categories CRUD
      const cat = await memberARepos.categories.create(businessAId, {
        name: "Viennoiseries",
        role: "regular",
      });
      expect(cat.id).toBeDefined();
      const updatedCat = await memberARepos.categories.update(businessAId, cat.id, {
        name: "Fine Viennoiseries",
      });
      expect(updatedCat.name).toBe("Fine Viennoiseries");

      // Products CRUD
      const prod = await memberARepos.products.create(businessAId, {
        categoryId: cat.id,
        name: "Pain aux Raisins",
        price: 250,
        unitCost: 80,
        stock: 15,
        visible: true,
        allergens: ["gluten", "eggs"],
        suggestAddOns: false,
      });
      expect(prod.id).toBeDefined();
      const updatedProd = await memberARepos.products.update(businessAId, prod.id, {
        price: 280,
      });
      expect(updatedProd.price).toBe(280);

      // Guests CRUD
      const guest = await memberARepos.guests.create(businessAId, {
        name: "Jean Valjean",
        phone: "+33677889900",
      });
      expect(guest.id).toBeDefined();
      const updatedGuest = await memberARepos.guests.update(businessAId, guest.id, {
        notes: "Morning regular",
      });
      expect(updatedGuest.notes).toBe("Morning regular");

      // Expenses CRUD
      const exp = await memberARepos.expenses.create(businessAId, {
        amount: 5000,
        date: tomorrow,
        description: "Butter delivery",
        tags: ["ingredients"],
      });
      expect(exp.id).toBeDefined();
      const updatedExp = await memberARepos.expenses.update(businessAId, exp.id, {
        amount: 5200,
      });
      expect(updatedExp.amount).toBe(5200);
      // Hard deletes are owner-only: a manager is refused, the owner may delete.
      await expect(memberARepos.expenses.delete(businessAId, exp.id)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await ownerARepos.expenses.delete(businessAId, exp.id);
      const exps = await memberARepos.expenses.list(businessAId);
      expect(exps.some((e) => e.id === exp.id)).toBe(false);
    });

    it("member A cannot see or modify tenant B rows (cross-tenant denial)", async () => {
      // Read denial: private tenant collections (orders, expenses, guests) are hidden under RLS
      expect(await memberARepos.orders.list(businessBId)).toEqual([]);
      expect(await memberARepos.expenses.list(businessBId)).toEqual([]);
      expect(await memberARepos.guests.list(businessBId)).toEqual([]);

      // Hidden product isolation: member A cannot see tenant B's hidden product
      expect(await memberARepos.products.findById(businessBId, prodBHiddenId)).toBeNull();

      // Bidirectional verification: Member B CAN see their own hidden product
      expect(await memberBRepos.products.findById(businessBId, prodBHiddenId)).not.toBeNull();

      // Write denial: member A cannot create, update, or add categories in tenant B
      await expect(
        memberARepos.products.create(businessBId, {
          categoryId: catBId,
          name: "Intruder Dish",
          price: 100,
          unitCost: 10,
          stock: 1,
          visible: true,
          allergens: [],
          suggestAddOns: false,
        }),
      ).rejects.toThrow();

      await expect(
        memberARepos.products.update(businessBId, prodBId, {
          price: 9999,
        }),
      ).rejects.toThrow();

      await expect(
        memberARepos.categories.create(businessBId, {
          name: "Intruder Category",
          role: "regular",
        }),
      ).rejects.toThrow();
    });

    it("member A cannot cancel an order belonging to tenant B", async () => {
      // Place order in Tenant B
      const orderB = await anonRepos.orders.place(businessBId, {
        guestName: "Tenant B Guest",
        guestPhone: "+33699887766",
        serviceType: "pickup",
        channel: "storefront",
        requestedDate: tomorrow,
        items: [{ productId: prodBId, quantity: 1 }],
      });

      // Member A attempts to cancel Tenant B's order
      await expect(
        memberARepos.orders.cancel(businessBId, orderB.orderId, "Unauthorized cancel attempt"),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("member cancel restores product stock atomically", async () => {
      const { data: initialP } = await adminClient
        .from("products")
        .select("stock")
        .eq("id", prodAVisibleId)
        .single();
      const initialStock = initialP?.stock ?? 18;

      const orderToCancel = await anonRepos.orders.place(businessAId, {
        guestName: "Cancel Test User",
        guestPhone: "+33655443322",
        serviceType: "pickup",
        channel: "storefront",
        requestedDate: tomorrow,
        items: [{ productId: prodAVisibleId, quantity: 3 }],
      });

      // Verify stock was reduced by 3
      const { data: midP } = await adminClient
        .from("products")
        .select("stock")
        .eq("id", prodAVisibleId)
        .single();
      expect(midP?.stock).toBe(initialStock - 3);

      // Member cancels order
      const cancelResult = await memberARepos.orders.cancel(
        businessAId,
        orderToCancel.orderId,
        "Customer requested cancellation",
      );
      expect(cancelResult.status).toBe("CANCELLED");

      // Verify stock was restored to initialStock
      const pAfter = await memberARepos.products.findById(businessAId, prodAVisibleId);
      expect(pAfter?.stock).toBe(initialStock);
    });

    it("members cannot rewrite money or integrity fields of an order directly", async () => {
      expect(trackedOrder).not.toBeNull();
      const id = trackedOrder!.orderId;
      for (const patch of [
        { total_amount: 1 },
        { tracking_token: "stolen" },
        { business_id: businessBId },
        { status: "COMPLETED" as const },
        { status_history: [] },
        { order_number: 9999 },
      ]) {
        const { error } = await memberAClient.from("orders").update(patch).eq("id", id);
        expect(error?.code, JSON.stringify(patch)).toBe("42501");
      }
      const { error: itemsError } = await memberAClient
        .from("order_items")
        .update({ unit_price: 1 })
        .eq("order_id", id);
      expect(itemsError?.code).toBe("42501");
      const { error: deleteItemsError } = await memberAClient
        .from("order_items")
        .delete()
        .eq("order_id", id);
      expect(deleteItemsError?.code).toBe("42501");
    });

    it("replace_order_items called directly ignores client names and prices", async () => {
      expect(trackedOrder).not.toBeNull();
      const id = trackedOrder!.orderId;
      const { error } = await memberAClient.rpc("replace_order_items", {
        p_business_id: businessAId,
        p_order_id: id,
        p_items: [
          {
            product_id: prodAVisibleId,
            quantity: 1,
            unit_price: 1,
            total_price: 1,
            product_name: "Hacked",
          },
        ],
      });
      expect(error).toBeNull();
      const { data: after } = await adminClient
        .from("order_items")
        .select("product_name, unit_price, total_price")
        .eq("order_id", id);
      expect(after).toHaveLength(1);
      expect(after![0].product_name).not.toBe("Hacked");
      expect(after![0].unit_price).toBeGreaterThan(1);
      expect(after![0].total_price).toBe(after![0].unit_price);
    });

    it("tenant-safe references: rows cannot point at another tenant's rows", async () => {
      const { error: productError } = await memberAClient.from("products").insert({
        business_id: businessAId,
        category_id: catBId,
        name: "Cross tenant product",
        price: 100,
      });
      expect(productError?.code).toBe("23503");

      const { data: guestB } = await adminClient
        .from("guests")
        .insert({ business_id: businessBId, name: "Guest B" })
        .select("id")
        .single();
      const { error: orderError } = await adminClient.from("orders").insert({
        business_id: businessAId,
        order_number: 987654,
        guest_id: guestB!.id,
        service_type: "pickup",
        channel: "phone",
        requested_date: tomorrow,
        total_amount: 100,
      });
      expect(orderError?.code).toBe("23503");
    });
  });

  describe("Owner-only actions (roles)", () => {
    const paymentChanges = [
      { revolutRevtag: "@intruder" },
      { weroIdentifier: "intruder-wero" },
      { paymentMethods: { cash: true, card: false, revolut: false, wero: false } },
      { paymentInstructionsEn: "Pay the intruder" },
      { paymentInstructionsFr: "Payez l'intrus" },
    ];

    for (const [label, getRepos] of [
      ["manager", () => memberARepos],
      ["staff", () => staffARepos],
    ] as const) {
      it(`a ${label} cannot change payment settings, the slug or delete an expense (FORBIDDEN)`, async () => {
        const repos = getRepos();
        for (const change of paymentChanges) {
          await expect(repos.business.updateSettings(businessAId, change)).rejects.toMatchObject({
            code: "FORBIDDEN",
          });
        }
        await expect(
          repos.business.update(businessAId, { slug: `hijack-${runId}-${label}` }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });

        const created = await repos.expenses.create(businessAId, {
          amount: 100,
          date: tomorrow,
          description: `owner-only delete ${label}`,
        });
        await expect(repos.expenses.delete(businessAId, created.id)).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
        expect(await ownerARepos.expenses.findById(businessAId, created.id)).not.toBeNull();
        await ownerARepos.expenses.delete(businessAId, created.id);

        // Everything else stays open.
        const ok = await repos.business.updateSettings(businessAId, { lowStockThreshold: 6 });
        expect(ok.lowStockThreshold).toBe(6);
        const profile = await repos.business.update(businessAId, { description: `by ${label}` });
        expect(profile.slug).toBe(slugA);
      });
    }

    it("an owner can change payment settings and the slug, and settings cannot be deleted by anyone", async () => {
      const updated = await ownerARepos.business.updateSettings(businessAId, {
        revolutRevtag: "@owner",
      });
      expect(updated.revolutRevtag).toBe("@owner");
      const renamed = await ownerARepos.business.update(businessAId, { slug: `${slugA}-x` });
      expect(renamed.slug).toBe(`${slugA}-x`);
      await ownerARepos.business.update(businessAId, { slug: slugA });

      for (const client of [ownerAClient, memberAClient, staffAClient]) {
        const { error } = await client
          .from("business_settings")
          .delete()
          .eq("business_id", businessAId);
        expect(error?.code).toBe("42501");
      }
      expect(await ownerARepos.business.getSettings(businessAId)).not.toBeNull();
    });

    it("only an owner may hard-delete guests", async () => {
      const guest = await ownerARepos.guests.create(businessAId, {
        name: "Delete Me",
        phone: "+33644556677",
      });
      const { data: denied } = await staffAClient
        .from("guests")
        .delete()
        .eq("id", guest.id)
        .select();
      expect(denied ?? []).toHaveLength(0);
      expect(await ownerARepos.guests.findById(businessAId, guest.id)).not.toBeNull();
      const { data: allowed, error } = await ownerAClient
        .from("guests")
        .delete()
        .eq("id", guest.id)
        .select();
      expect(error).toBeNull();
      expect(allowed).toHaveLength(1);
    });
  });

  describe("Non-Member Authenticated User Boundary", () => {
    it("non-member authenticated user sees empty collections and cannot place non-storefront orders", async () => {
      expect(await nonMemberRepos.orders.list(businessAId)).toEqual([]);
      expect(await nonMemberRepos.expenses.list(businessAId)).toEqual([]);
      expect(await nonMemberRepos.guests.list(businessAId)).toEqual([]);

      await expect(
        nonMemberRepos.orders.place(businessAId, {
          guestName: "NM User",
          guestPhone: "+33644332211",
          serviceType: "pickup",
          channel: "phone",
          requestedDate: tomorrow,
          items: [{ productId: prodAVisibleId, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("H9 Real Concurrency Tests (Row Locking & Advisory Ordering)", () => {
    it("two separate anon clients call orders.place on last unit concurrently: exactly 1 succeeds", async () => {
      const client1 = createSupabaseRepositories(
        createClient<Database>(url!, anonKey!, {
          auth: { autoRefreshToken: false, persistSession: false },
        }),
      );
      const client2 = createSupabaseRepositories(
        createClient<Database>(url!, anonKey!, {
          auth: { autoRefreshToken: false, persistSession: false },
        }),
      );

      const results = await Promise.allSettled([
        client1.orders.place(businessAId, {
          guestName: "Contender 1",
          guestPhone: "+33611110001",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: tomorrow,
          items: [{ productId: prodALowStockId, quantity: 1 }],
        }),
        client2.orders.place(businessAId, {
          guestName: "Contender 2",
          guestPhone: "+33611110002",
          serviceType: "pickup",
          channel: "storefront",
          requestedDate: tomorrow,
          items: [{ productId: prodALowStockId, quantity: 1 }],
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectedError).toBeInstanceOf(OrderRepoError);
      expect((rejectedError as OrderRepoError).code).toBe("STOCK_ERROR");

      // Verify database state: product stock is exactly 0 and exactly 1 order row exists for this item
      const { data: p } = await adminClient
        .from("products")
        .select("stock")
        .eq("id", prodALowStockId)
        .single();
      expect(p?.stock).toBe(0);

      const { count } = await adminClient
        .from("order_items")
        .select("*", { count: "exact", head: true })
        .eq("product_id", prodALowStockId);
      expect(count).toBe(1);
    });

    it("N=5 parallel orders for stock 2: exactly 2 succeed, 3 rejected with STOCK_ERROR, final stock 0", async () => {
      const parallelClients = Array.from({ length: 5 }, () =>
        createSupabaseRepositories(
          createClient<Database>(url!, anonKey!, {
            auth: { autoRefreshToken: false, persistSession: false },
          }),
        ),
      );

      const results = await Promise.allSettled(
        parallelClients.map((client, idx) =>
          client.orders.place(businessAId, {
            guestName: `Concurrent Buyer ${idx}`,
            guestPhone: `+3362222000${idx}`,
            serviceType: "pickup",
            channel: "storefront",
            requestedDate: tomorrow,
            items: [{ productId: prodAStock2Id, quantity: 1 }],
          }),
        ),
      );

      const fulfilled = results.filter((r) => r.status === "fulfilled") as Array<
        PromiseFulfilledResult<PlacedOrderSummary>
      >;
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(2);
      expect(rejected.length).toBe(3);

      for (const r of rejected) {
        const err = (r as PromiseRejectedResult).reason;
        expect(err).toBeInstanceOf(OrderRepoError);
        expect((err as OrderRepoError).code).toBe("STOCK_ERROR");
      }

      const { data: p } = await adminClient
        .from("products")
        .select("stock")
        .eq("id", prodAStock2Id)
        .single();
      expect(p?.stock).toBe(0);

      // Verify order numbers are unique and strictly sequential under parallel placement
      const orderNumbers = fulfilled.map((f) => f.value.orderNumber).sort((a, b) => a - b);
      const uniqueNumbers = new Set(orderNumbers);
      expect(uniqueNumbers.size).toBe(orderNumbers.length);
      for (let i = 1; i < orderNumbers.length; i++) {
        expect(orderNumbers[i]).toBe(orderNumbers[i - 1] + 1);
      }
    });
  });

  describe("MemberRepository.findMembershipForUser (RLS & Determinism Contract)", () => {
    it("member A gets its own business membership and summary", async () => {
      const membership = await memberARepos.members.findMembershipForUser(userAId);
      expect(membership).not.toBeNull();
      expect(membership?.member.businessId).toBe(businessAId);
      expect(membership?.member.role).toBe("manager");
      expect(membership?.business.id).toBe(businessAId);
      expect(membership?.business.slug).toBe(slugA);
      expect(membership?.business.currency).toBe("EUR");
    });

    it("non-member gets null from findMembershipForUser", async () => {
      const membership = await nonMemberRepos.members.findMembershipForUser(nonMemberUserId);
      expect(membership).toBeNull();
    });

    it("user with two memberships gets the oldest deterministically", async () => {
      const earlierDate = "2026-01-01T00:00:00.000Z";
      const laterDate = "2026-01-02T00:00:00.000Z";

      // Ensure user A's existing membership in business A is earlier
      await adminClient
        .from("business_members")
        .update({ created_at: earlierDate })
        .eq("business_id", businessAId)
        .eq("user_id", userAId);

      // Insert second membership for user A in business B with later created_at
      const secondMembershipId = crypto.randomUUID();
      const { error: insertErr } = await adminClient.from("business_members").insert({
        id: secondMembershipId,
        business_id: businessBId,
        user_id: userAId,
        role: "staff",
        created_at: laterDate,
      });
      if (insertErr) throw insertErr;

      try {
        const membership = await memberARepos.members.findMembershipForUser(userAId);
        expect(membership).not.toBeNull();
        // Deterministically returns the earliest created membership (business A)
        expect(membership?.member.businessId).toBe(businessAId);
        expect(membership?.member.role).toBe("manager");
        expect(membership?.business.id).toBe(businessAId);
        expect(membership?.business.slug).toBe(slugA);
      } finally {
        await adminClient.from("business_members").delete().eq("id", secondMembershipId);
      }
    });
  });
});
