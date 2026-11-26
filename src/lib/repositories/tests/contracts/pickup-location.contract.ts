import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

const OTHER_BUSINESS_ID = "00000000-0000-4000-8000-0000000000aa";
const MISSING_ID = "00000000-0000-4000-8000-000000000099";

const WEEKLY_HOURS = {
  mon: [],
  tue: [{ open: "18:00", close: "20:00" }],
  wed: [{ open: "18:00", close: "20:00" }],
  thu: [{ open: "18:00", close: "20:00" }],
  fri: [{ open: "18:00", close: "20:00" }],
  sat: [{ open: "18:00", close: "20:00" }],
  sun: [],
};

export function describePickupLocationRepositoryContract(
  getRepositories: () => Promise<Repositories> | Repositories,
  businessId: string,
): void {
  describe("PickupLocationRepository contract", () => {
    /** Runs `body` and always removes the locations it created, so live runs stay clean. */
    async function withLocations(
      body: (repos: Repositories, created: string[]) => Promise<void>,
    ): Promise<void> {
      const repos = await getRepositories();
      const created: string[] = [];
      try {
        await body(repos, created);
      } finally {
        for (const id of created) {
          await repos.pickupLocations.delete(businessId, id).catch(() => undefined);
        }
      }
    }

    it("create applies defaults and appends after the last location", async () => {
      await withLocations(async (repos, created) => {
        const before = await repos.pickupLocations.listByBusiness(businessId);
        const lastOrder = before.reduce((max, l) => Math.max(max, l.sortOrder), -1);

        const location = await repos.pickupLocations.create(businessId, {
          name: "Contract RER stop",
          address: "1 Place de la Gare",
          postcode: "93200",
        });
        created.push(location.id);

        expect(location).toMatchObject({
          businessId,
          name: "Contract RER stop",
          description: null,
          address: "1 Place de la Gare",
          postcode: "93200",
          feeCents: 0,
          weeklyHours: null,
          isActive: true,
          sortOrder: lastOrder + 1,
        });
        expect(location.id).toBeDefined();
        expect(location.createdAt).toBeDefined();
      });
    });

    it("update changes only the given fields and persists hours", async () => {
      await withLocations(async (repos, created) => {
        const location = await repos.pickupLocations.create(businessId, {
          name: "Contract update",
          description: "Behind the kiosk",
          address: "2 Rue du Test",
          postcode: "93210",
        });
        created.push(location.id);

        const updated = await repos.pickupLocations.update(businessId, location.id, {
          feeCents: 150,
          weeklyHours: WEEKLY_HOURS,
          isActive: false,
        });
        expect(updated).toMatchObject({
          name: "Contract update",
          description: "Behind the kiosk",
          feeCents: 150,
          weeklyHours: WEEKLY_HOURS,
          isActive: false,
        });

        const cleared = await repos.pickupLocations.update(businessId, location.id, {
          description: null,
          weeklyHours: null,
        });
        expect(cleared).toMatchObject({ description: null, weeklyHours: null, feeCents: 150 });
      });
    });

    it("listByBusiness is ordered by sortOrder and activeOnly hides inactive ones", async () => {
      await withLocations(async (repos, created) => {
        const active = await repos.pickupLocations.create(businessId, {
          name: "Contract active",
          address: "3 Rue Active",
          postcode: "93200",
        });
        const inactive = await repos.pickupLocations.create(businessId, {
          name: "Contract inactive",
          address: "4 Rue Inactive",
          postcode: "93200",
          isActive: false,
        });
        created.push(active.id, inactive.id);

        const all = await repos.pickupLocations.listByBusiness(businessId);
        for (let i = 1; i < all.length; i++) {
          expect(all[i].sortOrder).toBeGreaterThanOrEqual(all[i - 1].sortOrder);
        }
        expect(all.map((l) => l.id)).toEqual(expect.arrayContaining([active.id, inactive.id]));

        const activeOnly = await repos.pickupLocations.listByBusiness(businessId, {
          activeOnly: true,
        });
        expect(activeOnly.every((l) => l.isActive)).toBe(true);
        expect(activeOnly.map((l) => l.id)).toContain(active.id);
        expect(activeOnly.map((l) => l.id)).not.toContain(inactive.id);
      });
    });

    it("reorder sets the position of the given locations", async () => {
      await withLocations(async (repos, created) => {
        const a = await repos.pickupLocations.create(businessId, {
          name: "Contract A",
          address: "5 Rue A",
          postcode: "93200",
        });
        const b = await repos.pickupLocations.create(businessId, {
          name: "Contract B",
          address: "6 Rue B",
          postcode: "93200",
        });
        created.push(a.id, b.id);

        const existing = (await repos.pickupLocations.listByBusiness(businessId))
          .map((l) => l.id)
          .filter((id) => id !== a.id && id !== b.id);
        const reordered = await repos.pickupLocations.reorder(businessId, [
          b.id,
          a.id,
          ...existing,
        ]);

        const ids = reordered.map((l) => l.id);
        expect(ids.slice(0, 2)).toEqual([b.id, a.id]);
        const listed = await repos.pickupLocations.listByBusiness(businessId);
        expect(listed.map((l) => l.id).slice(0, 2)).toEqual([b.id, a.id]);
      });
    });

    it("delete removes the location and throws for an unknown id", async () => {
      await withLocations(async (repos) => {
        const location = await repos.pickupLocations.create(businessId, {
          name: "Contract delete",
          address: "7 Rue Delete",
          postcode: "93200",
        });
        await repos.pickupLocations.delete(businessId, location.id);
        const listed = await repos.pickupLocations.listByBusiness(businessId);
        expect(listed.map((l) => l.id)).not.toContain(location.id);
        await expect(repos.pickupLocations.delete(businessId, location.id)).rejects.toThrow();
      });
    });

    it("update, delete and reorder never reach another business's locations", async () => {
      await withLocations(async (repos, created) => {
        const location = await repos.pickupLocations.create(businessId, {
          name: "Contract tenant",
          address: "8 Rue Tenant",
          postcode: "93200",
        });
        created.push(location.id);

        await expect(
          repos.pickupLocations.update(OTHER_BUSINESS_ID, location.id, { name: "Hijacked" }),
        ).rejects.toThrow();
        await expect(
          repos.pickupLocations.delete(OTHER_BUSINESS_ID, location.id),
        ).rejects.toThrow();
        await expect(
          repos.pickupLocations.reorder(OTHER_BUSINESS_ID, [location.id]),
        ).rejects.toThrow();
        await expect(
          repos.pickupLocations.update(businessId, MISSING_ID, { name: "Ghost" }),
        ).rejects.toThrow();

        const listed = await repos.pickupLocations.listByBusiness(businessId);
        expect(listed.find((l) => l.id === location.id)?.name).toBe("Contract tenant");
      });
    });
  });
}
