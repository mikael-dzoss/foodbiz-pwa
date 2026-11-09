// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { PRODUCT_IMAGES_BUCKET } from "@/domain/product-image";

const url = process.env.SUPABASE_TEST_URL;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;

const hasLiveSupabase = Boolean(url && serviceKey && anonKey);

// In CI, missing environment variables must fail rather than silently skipping (Task 2 / H5 / #123).
// Locally without a running Supabase container, the suite is cleanly skipped with an actionable guide.
const shouldSkip = !hasLiveSupabase && !process.env.CI;

if (shouldSkip) {
  console.warn(
    "[storage-live.contract.test.ts] Skipping live Supabase storage contract suite: SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY, or SUPABASE_TEST_ANON_KEY not set.\n" +
      "To run this suite locally:\n" +
      "  1. npm run db:start\n" +
      "  2. eval $(supabase status -o env | grep -E '^[A-Z0-9_]+=')\n" +
      '  3. SUPABASE_TEST_URL="$API_URL" SUPABASE_TEST_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" SUPABASE_TEST_ANON_KEY="$ANON_KEY" npm run test:live\n',
  );
}

describe.skipIf(shouldSkip)(
  "Supabase Storage Live Security & Isolation Contract Suite (#123)",
  () => {
    let adminClient: SupabaseClient<Database>;
    let anonClient: SupabaseClient<Database>;
    let memberAClient: SupabaseClient<Database>;
    let memberBClient: SupabaseClient<Database>;

    const runId = crypto.randomUUID().slice(0, 8);
    const businessAId = crypto.randomUUID();
    const businessBId = crypto.randomUUID();
    const slugA = `storage-tenant-a-${runId}`;
    const slugB = `storage-tenant-b-${runId}`;

    const memberAEmail = `storage-member-a-${runId}@example.com`;
    const memberBEmail = `storage-member-b-${runId}@example.com`;
    const testPassword = "Password123!";

    let userAId = "";
    let userBId = "";

    const validPngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const fileAPath = `${businessAId}/item-${runId}.png`;
    const fileBPath = `${businessBId}/item-${runId}.png`;

    beforeAll(async () => {
      if (process.env.CI && (!url || !serviceKey || !anonKey)) {
        throw new Error(
          "Missing SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY, or SUPABASE_TEST_ANON_KEY in CI environment.",
        );
      }
      if (!url || !serviceKey || !anonKey) {
        return;
      }

      // 1. Service-role admin client for seeding
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
        { id: businessAId, name: `Storage Biz A ${runId}`, slug: slugA, currency: "EUR" },
        { id: businessBId, name: `Storage Biz B ${runId}`, slug: slugB, currency: "EUR" },
      ]);
      if (errBiz) throw new Error(`Failed to insert businesses: ${errBiz.message}`);

      // 4. Attach users to their respective businesses
      const { error: errMembers } = await adminClient.from("business_members").insert([
        { id: crypto.randomUUID(), business_id: businessAId, user_id: userAId, role: "manager" },
        { id: crypto.randomUUID(), business_id: businessBId, user_id: userBId, role: "manager" },
      ]);
      if (errMembers) throw new Error(`Failed to insert business members: ${errMembers.message}`);

      // 5. Initialize anon and member clients
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
    });

    afterAll(async () => {
      if (!adminClient) return;
      const businessIds = [businessAId, businessBId];

      // Clean up storage objects under business folders
      try {
        const { data: objs } = await adminClient
          .from("objects" as unknown as "businesses")
          .select("name" as unknown as "*")
          .eq("bucket_id" as unknown as "id", PRODUCT_IMAGES_BUCKET);
        if (objs && Array.isArray(objs)) {
          const toRemove = (objs as unknown as Array<{ name: string }>)
            .map((o) => o.name)
            .filter((name) => businessIds.some((bid) => name.startsWith(`${bid}/`)));
          if (toRemove.length > 0) {
            await adminClient.storage.from(PRODUCT_IMAGES_BUCKET).remove(toRemove);
          }
        }
      } catch {
        // Best-effort teardown
      }

      await adminClient.from("business_members").delete().in("business_id", businessIds);
      await adminClient.from("businesses").delete().in("id", businessIds);

      for (const uid of [userAId, userBId]) {
        if (uid) {
          await adminClient.auth.admin.deleteUser(uid).catch(() => {});
        }
      }
    });

    describe("Product Image Bucket Policies & Security (#123)", () => {
      it("1. member uploads inside <own business id>/ OK", async () => {
        const { data, error } = await memberAClient.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(fileAPath, validPngBytes, {
            contentType: "image/png",
            upsert: false,
          });

        expect(error).toBeNull();
        expect(data?.path).toBe(fileAPath);
      });

      it("2. upload into another tenant's folder denied", async () => {
        const crossTenantPath = `${businessBId}/evil-${runId}.png`;
        const { error } = await memberAClient.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(crossTenantPath, validPngBytes, {
            contentType: "image/png",
            upsert: false,
          });

        expect(error).not.toBeNull();
      });

      it("3. anon upload denied", async () => {
        const anonPath = `${businessAId}/anon-${runId}.png`;
        const { error } = await anonClient.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(anonPath, validPngBytes, {
            contentType: "image/png",
            upsert: false,
          });

        expect(error).not.toBeNull();
      });

      it("4. anon public GET of an uploaded file works via public URL", async () => {
        const { data: pubData } = memberAClient.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .getPublicUrl(fileAPath);

        expect(pubData.publicUrl).toBeDefined();

        const res = await fetch(pubData.publicUrl);
        expect(res.ok).toBe(true);
        expect(res.status).toBe(200);

        const arrayBuffer = await res.arrayBuffer();
        const fetchedBytes = new Uint8Array(arrayBuffer);
        expect(fetchedBytes).toEqual(validPngBytes);
      });

      it("5. anon list returns nothing", async () => {
        const { data, error } = await anonClient.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .list(businessAId);

        // Anon has no SELECT policy on storage.objects; list returns empty array or error
        if (data) {
          expect(data).toHaveLength(0);
        } else {
          expect(error).not.toBeNull();
        }
      });

      it("6. disallowed MIME rejected by bucket", async () => {
        const textBytes = new TextEncoder().encode("not-an-image text payload");
        const textPath = `${businessAId}/disallowed-${runId}.txt`;

        const { error } = await memberAClient.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(textPath, textBytes, {
            contentType: "text/plain",
            upsert: false,
          });

        expect(error).not.toBeNull();
      });

      it("7. >5 MB (5242881 bytes) rejected by bucket limit", async () => {
        // 5 MB = 5,242,880 bytes. 5,242,881 bytes is 1 byte over the limit.
        const oversizedBytes = new Uint8Array(5242881);
        oversizedBytes[0] = 0x89;
        oversizedBytes[1] = 0x50;
        oversizedBytes[2] = 0x4e;
        oversizedBytes[3] = 0x47;
        oversizedBytes[4] = 0x0d;
        oversizedBytes[5] = 0x0a;
        oversizedBytes[6] = 0x1a;
        oversizedBytes[7] = 0x0a;

        const oversizedPath = `${businessAId}/oversized-${runId}.png`;
        const { error } = await memberAClient.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(oversizedPath, oversizedBytes, {
            contentType: "image/png",
            upsert: false,
          });

        expect(error).not.toBeNull();
      });

      it("8. member can delete own file, not another tenant's", async () => {
        // 1. Member B uploads to Tenant B folder
        const { error: errBUpload } = await memberBClient.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(fileBPath, validPngBytes, {
            contentType: "image/png",
            upsert: false,
          });
        expect(errBUpload).toBeNull();

        // 2. Member A attempts to delete Member B's file
        const { data: removeBData } = await memberAClient.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .remove([fileBPath]);

        if (removeBData) {
          expect(removeBData).not.toContainEqual(expect.objectContaining({ name: fileBPath }));
        }

        // Verify Member B's file is still accessible via public URL
        const { data: bPub } = memberBClient.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .getPublicUrl(fileBPath);
        const resB = await fetch(bPub.publicUrl);
        expect(resB.status).toBe(200);

        // 3. Member A successfully deletes own file
        const { data: removeAData, error: removeAErr } = await memberAClient.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .remove([fileAPath]);

        expect(removeAErr).toBeNull();
        expect(removeAData).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: fileAPath })]),
        );
      });
    });
  },
);
