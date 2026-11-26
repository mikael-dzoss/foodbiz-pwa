import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRepositories, DEMO_BUSINESS_ID } from "@/lib/repositories/mock";
import {
  createPickupLocationAction,
  deletePickupLocationAction,
  reorderPickupLocationsAction,
  setPickupLocationActiveAction,
  setShopPickupEnabledAction,
  updatePickupLocationAction,
} from "../pickup-location-actions";

const mockRevalidatePath = vi.fn();
const mockUpdateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) =>
    type ? mockRevalidatePath(path, type) : mockRevalidatePath(path),
  updateTag: (tag: string) => mockUpdateTag(tag),
}));

const state = vi.hoisted(() => ({ repos: null as unknown }));
vi.mock("@/lib/repositories", () => ({ getRepositories: () => state.repos }));

vi.mock("@/features/auth", async () => {
  const { DEMO_BUSINESS_ID: businessId } = await import("@/lib/repositories/mock");
  return {
    requireAuthenticatedAction: vi.fn(async () => ({
      session: {
        user: {
          id: "00000000-0000-4000-8000-000000000002",
          email: "manager@test.com",
          name: "Marie",
          role: "manager",
          businessId,
        },
        business: { id: businessId },
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      businessId,
    })),
    requireOwnerAction: vi.fn(),
  };
});

const location = {
  name: "Gare RER B",
  address: "Place de la gare",
  postcode: "93210",
};

type Repos = ReturnType<typeof createMockRepositories>;
let repos: Repos;

async function seedLocation(extra: Partial<typeof location & { isActive: boolean }> = {}) {
  return repos.pickupLocations.create(DEMO_BUSINESS_ID, { ...location, ...extra });
}

beforeEach(() => {
  vi.clearAllMocks();
  repos = createMockRepositories();
  state.repos = repos;
});

describe("pickup location actions", () => {
  it("creates a location with defaults and revalidates the storefront", async () => {
    const res = await createPickupLocationAction(location);
    expect(res).toMatchObject({ ok: true, data: { feeCents: 0, isActive: true, sortOrder: 0 } });
    expect(mockUpdateTag).toHaveBeenCalledWith("storefront-catalog");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/settings/pickup-locations");
  });

  it("rejects invalid input with field errors", async () => {
    const res = await createPickupLocationAction({ ...location, postcode: "12" });
    expect(res).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { postcode: [expect.any(String)] },
    });
    expect(await repos.pickupLocations.listByBusiness(DEMO_BUSINESS_ID)).toHaveLength(0);
  });

  it("refuses the 21st location", async () => {
    for (let i = 0; i < 20; i++) await seedLocation({ name: `Spot ${i}` });
    const res = await createPickupLocationAction(location);
    expect(res).toMatchObject({ ok: false, code: "CONFLICT", reason: "PICKUP_LOCATIONS_LIMIT" });
  });

  it("updates fields and returns NOT_FOUND for another business's or unknown id", async () => {
    const created = await seedLocation();
    expect(await updatePickupLocationAction({ id: created.id, feeCents: 150 })).toMatchObject({
      ok: true,
      data: { feeCents: 150, name: "Gare RER B" },
    });
    expect(
      await updatePickupLocationAction({ id: "99999999-9999-4999-8999-999999999999", feeCents: 1 }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("deactivates the last option only when the shop pickup stays on", async () => {
    const created = await seedLocation();
    await setShopPickupEnabledAction({ enabled: false });
    const blocked = await setPickupLocationActiveAction({ id: created.id, isActive: false });
    expect(blocked).toMatchObject({ ok: false, code: "CONFLICT", reason: "LAST_PICKUP_OPTION" });
    expect(await updatePickupLocationAction({ id: created.id, isActive: false })).toMatchObject({
      ok: false,
      reason: "LAST_PICKUP_OPTION",
    });

    await setShopPickupEnabledAction({ enabled: true });
    expect(await setPickupLocationActiveAction({ id: created.id, isActive: false })).toMatchObject({
      ok: true,
      data: { isActive: false },
    });
  });

  it("refuses to delete the last active option, allows deleting otherwise", async () => {
    const created = await seedLocation();
    await setShopPickupEnabledAction({ enabled: false });
    expect(await deletePickupLocationAction({ id: created.id })).toMatchObject({
      ok: false,
      reason: "LAST_PICKUP_OPTION",
    });
    const second = await seedLocation({ name: "Second" });
    expect(await deletePickupLocationAction({ id: created.id })).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await deletePickupLocationAction({ id: second.id })).toMatchObject({ ok: false });
    expect(await repos.pickupLocations.listByBusiness(DEMO_BUSINESS_ID)).toHaveLength(1);
  });

  it("refuses to turn the shop off without an active location", async () => {
    expect(await setShopPickupEnabledAction({ enabled: false })).toMatchObject({
      ok: false,
      reason: "LAST_PICKUP_OPTION",
    });
    await seedLocation({ isActive: false });
    expect(await setShopPickupEnabledAction({ enabled: false })).toMatchObject({ ok: false });
    await seedLocation({ name: "Active" });
    expect(await setShopPickupEnabledAction({ enabled: false })).toMatchObject({
      ok: true,
      data: { shopPickupEnabled: false },
    });
  });

  it("does not apply the rule while the pickup service type is off", async () => {
    await repos.business.updateSettings(DEMO_BUSINESS_ID, {
      serviceTypes: { pickup: false, delivery: true, dineIn: false },
    });
    expect(await setShopPickupEnabledAction({ enabled: false })).toMatchObject({ ok: true });
  });

  it("reorders the locations and rejects unknown ids", async () => {
    const a = await seedLocation({ name: "A" });
    const b = await seedLocation({ name: "B" });
    const res = await reorderPickupLocationsAction({ ids: [b.id, a.id] });
    expect(res).toMatchObject({ ok: true });
    if (res.ok) expect(res.data.map((l) => l.name)).toEqual(["B", "A"]);
    expect(
      await reorderPickupLocationsAction({ ids: ["99999999-9999-4999-8999-999999999999"] }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await reorderPickupLocationsAction({ ids: [a.id, a.id] })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
  });
});
