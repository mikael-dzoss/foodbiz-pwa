// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import {
  subscribeToOrderInserts,
  type OrderInsertSubscription,
  type RealtimeSubscriptionStatus,
} from "../realtime";

const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;

const hasLiveSupabase = Boolean(url && serviceKey && anonKey);

// In CI, missing environment variables must fail rather than silently skipping (#124 / H5).
// Locally without a running Supabase container, the suite is cleanly skipped with an actionable guide.
const shouldSkip = !hasLiveSupabase && !process.env.CI;

if (shouldSkip) {
  console.warn(
    "[realtime-live.contract.test.ts] Skipping live Supabase realtime contract suite: SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY, or SUPABASE_TEST_ANON_KEY not set.\n" +
      "To run this suite locally:\n" +
      "  1. npm run db:start\n" +
      "  2. eval $(supabase status -o env | grep -E '^[A-Z0-9_]+=')\n" +
      '  3. SUPABASE_TEST_URL="$API_URL" SUPABASE_TEST_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" SUPABASE_TEST_ANON_KEY="$ANON_KEY" npm run test:live\n',
  );
}

function waitForEvent<T>(
  register: (resolve: (value: T) => void, reject: (err: Error) => void) => void,
  timeoutMs = 15000,
  timeoutMessage = "Timed out waiting for event",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${timeoutMessage} (${timeoutMs}ms)`));
    }, timeoutMs);

    register(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe.skipIf(shouldSkip)(
  "Supabase Realtime Live Security & Tenant Isolation Contract Suite (#124)",
  () => {
    let adminClient: SupabaseClient<Database>;
    let anonClient: SupabaseClient<Database>;
    let memberAClient: SupabaseClient<Database>;

    const runId = crypto.randomUUID().slice(0, 8);
    const businessAId = crypto.randomUUID();
    const businessBId = crypto.randomUUID();
    const slugA = `realtime-tenant-a-${runId}`;
    const slugB = `realtime-tenant-b-${runId}`;

    const memberAEmail = `realtime-member-a-${runId}@example.com`;
    const memberBEmail = `realtime-member-b-${runId}@example.com`;
    const testPassword = "Password123!";

    let userAId = "";
    let userBId = "";
    const guestAId = crypto.randomUUID();
    const guestBId = crypto.randomUUID();

    const createdOrderIds: string[] = [];
    const activeSubscriptions: OrderInsertSubscription[] = [];

    beforeAll(async () => {
      if (process.env.CI && (!url || !serviceKey || !anonKey)) {
        throw new Error(
          "Missing SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY, or SUPABASE_TEST_ANON_KEY in CI environment.",
        );
      }
      if (!url || !serviceKey || !anonKey) {
        return;
      }

      // 1. Service-role admin client for provisioning and order insertion
      adminClient = createClient<Database>(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // 2. Create authenticated users for Tenant A and Tenant B
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

      // 3. Seed two isolated businesses
      const { error: errBiz } = await adminClient.from("businesses").insert([
        { id: businessAId, name: `Realtime Biz A ${runId}`, slug: slugA, currency: "EUR" },
        { id: businessBId, name: `Realtime Biz B ${runId}`, slug: slugB, currency: "EUR" },
      ]);
      if (errBiz) throw new Error(`Failed to insert businesses: ${errBiz.message}`);

      // 4. Attach users to their respective businesses
      const { error: errMembers } = await adminClient.from("business_members").insert([
        { id: crypto.randomUUID(), business_id: businessAId, user_id: userAId, role: "manager" },
        { id: crypto.randomUUID(), business_id: businessBId, user_id: userBId, role: "manager" },
      ]);
      if (errMembers) throw new Error(`Failed to insert business members: ${errMembers.message}`);

      // 5. Seed guests for order foreign keys
      const { error: errGuests } = await adminClient.from("guests").insert([
        { id: guestAId, business_id: businessAId, name: "Customer A", phone: "+33600000001" },
        { id: guestBId, business_id: businessBId, name: "Customer B", phone: "+33600000002" },
      ]);
      if (errGuests) throw new Error(`Failed to insert guests: ${errGuests.message}`);

      // 6. Initialize anon and member clients
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
    });

    afterAll(async () => {
      // 1. Unsubscribe any open channels
      for (const sub of activeSubscriptions) {
        try {
          await sub.unsubscribe();
        } catch {
          // Best-effort cleanup
        }
      }

      if (!adminClient) return;
      const businessIds = [businessAId, businessBId];

      // 2. Clean up orders
      if (createdOrderIds.length > 0) {
        await adminClient.from("orders").delete().in("id", createdOrderIds);
      }

      // 3. Clean up guests, members, and businesses
      await adminClient.from("guests").delete().in("business_id", businessIds);
      await adminClient.from("business_members").delete().in("business_id", businessIds);
      await adminClient.from("businesses").delete().in("id", businessIds);

      // 4. Delete auth users
      for (const uid of [userAId, userBId]) {
        if (uid) {
          await adminClient.auth.admin.deleteUser(uid).catch(() => {});
        }
      }
    });

    it("subscribes to realtime order inserts and reaches SUBSCRIBED status", async () => {
      let statusReceived = "";

      const statusPromise = waitForEvent<RealtimeSubscriptionStatus>(
        (resolve, reject) => {
          const sub = subscribeToOrderInserts(memberAClient, businessAId, {
            onStatusChange: (status, err) => {
              statusReceived = status;
              if (status === "SUBSCRIBED") {
                resolve(status);
              } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                reject(err ?? new Error(`Subscription failed with status ${status}`));
              }
            },
          });
          activeSubscriptions.push(sub);
          return () => {};
        },
        20000,
        "Timed out waiting for realtime subscription to reach SUBSCRIBED",
      );

      const finalStatus = await statusPromise;
      expect(finalStatus).toBe("SUBSCRIBED");
      expect(statusReceived).toBe("SUBSCRIBED");
    }, 30000);

    it("member A receives an INSERT event when an order is placed for business A", async () => {
      const orderAId = crypto.randomUUID();
      createdOrderIds.push(orderAId);

      let receivedOrderId = "";

      const insertPromise = waitForEvent<string>(
        (resolve, reject) => {
          const sub = subscribeToOrderInserts(memberAClient, businessAId, {
            onInsert: (orderId) => {
              if (orderId === orderAId) {
                receivedOrderId = orderId;
                resolve(orderId);
              }
            },
            onStatusChange: (status, err) => {
              if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                reject(err ?? new Error(`Channel error: ${status}`));
              }
            },
          });
          activeSubscriptions.push(sub);
          return () => {};
        },
        20000,
        "Timed out waiting for order INSERT realtime event on business A",
      );

      // Wait briefly for subscription to settle before inserting
      await delay(1000);

      const { error: insertErr } = await adminClient.from("orders").insert({
        id: orderAId,
        business_id: businessAId,
        order_number: 101,
        guest_id: guestAId,
        tracking_token: `token-${runId}-a1`,
        submitted_name: "Customer A Live",
        service_type: "pickup",
        channel: "storefront",
        status: "NEW",
        paid: "unpaid",
        payment_preference: "on_handover",
        total_amount: 1850,
        requested_date: new Date().toISOString().slice(0, 10),
      });
      expect(insertErr).toBeNull();

      const emittedId = await insertPromise;
      expect(emittedId).toBe(orderAId);
      expect(receivedOrderId).toBe(orderAId);
    }, 30000);

    it("member A does NOT receive an event when an order is placed for business B (tenant isolation)", async () => {
      const orderBId = crypto.randomUUID();
      createdOrderIds.push(orderBId);

      let receivedCountForBizB = 0;

      const sub = subscribeToOrderInserts(memberAClient, businessAId, {
        onInsert: (orderId) => {
          if (orderId === orderBId) {
            receivedCountForBizB++;
          }
        },
      });
      activeSubscriptions.push(sub);

      await delay(1000);

      // Insert order for business B
      const { error: insertErr } = await adminClient.from("orders").insert({
        id: orderBId,
        business_id: businessBId,
        order_number: 201,
        guest_id: guestBId,
        tracking_token: `token-${runId}-b1`,
        submitted_name: "Customer B Live",
        service_type: "delivery",
        channel: "storefront",
        status: "NEW",
        paid: "unpaid",
        payment_preference: "on_handover",
        total_amount: 3200,
        requested_date: new Date().toISOString().slice(0, 10),
      });
      expect(insertErr).toBeNull();

      // Wait 3 seconds to confirm no leaked event reaches Member A
      await delay(3000);

      expect(receivedCountForBizB).toBe(0);
    }, 30000);

    it("anonymous client receives no order events due to RLS restriction", async () => {
      const orderAnonTargetId = crypto.randomUUID();
      createdOrderIds.push(orderAnonTargetId);

      let anonReceivedCount = 0;

      const sub = subscribeToOrderInserts(anonClient, businessAId, {
        onInsert: () => {
          anonReceivedCount++;
        },
      });
      activeSubscriptions.push(sub);

      await delay(1000);

      // Insert another order for business A
      const { error: insertErr } = await adminClient.from("orders").insert({
        id: orderAnonTargetId,
        business_id: businessAId,
        order_number: 102,
        guest_id: guestAId,
        tracking_token: `token-${runId}-a2`,
        submitted_name: "Customer A Anon Probe",
        service_type: "pickup",
        channel: "storefront",
        status: "NEW",
        paid: "unpaid",
        payment_preference: "on_handover",
        total_amount: 1400,
        requested_date: new Date().toISOString().slice(0, 10),
      });
      expect(insertErr).toBeNull();

      // Wait 3 seconds to confirm RLS drops CDC payloads to anon
      await delay(3000);

      expect(anonReceivedCount).toBe(0);
    }, 30000);
  },
);
