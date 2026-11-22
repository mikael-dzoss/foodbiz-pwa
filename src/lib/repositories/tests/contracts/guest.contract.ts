import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

export function describeGuestRepositoryContract(
  getRepositories: () => Promise<Repositories> | Repositories,
  businessId: string,
): void {
  describe("GuestRepository contract", () => {
    it("list returns all guests for businessId", async () => {
      const repos = await getRepositories();
      const guests = await repos.guests.list(businessId);
      expect(guests.length).toBeGreaterThan(0);
      expect(guests.every((g) => g.businessId === businessId)).toBe(true);
    });

    it("findById returns guest or null", async () => {
      const repos = await getRepositories();
      const first = (await repos.guests.list(businessId))[0];
      const found = await repos.guests.findById(businessId, first.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe(first.name);

      const notFound = await repos.guests.findById(
        businessId,
        "00000000-0000-4000-8000-000000000099",
      );
      expect(notFound).toBeNull();
    });

    it("findByPhone finds guest by local or international format", async () => {
      const repos = await getRepositories();
      const firstWithPhone = (await repos.guests.list(businessId)).find((g) => Boolean(g.phone));
      expect(firstWithPhone).toBeDefined();

      if (firstWithPhone?.phone) {
        // Direct E.164 match
        const found = await repos.guests.findByPhone(businessId, firstWithPhone.phone);
        expect(found?.id).toBe(firstWithPhone.id);

        // Local format match (e.g. 06 12 34 56 71 for +33612345671)
        if (firstWithPhone.phone.startsWith("+33")) {
          const localPhone = `0${firstWithPhone.phone.slice(3)}`;
          const foundLocal = await repos.guests.findByPhone(businessId, localPhone);
          expect(foundLocal?.id).toBe(firstWithPhone.id);
        }
      }

      const notFound = await repos.guests.findByPhone(businessId, "+33699999999");
      expect(notFound).toBeNull();
    });

    it("create adds a guest with normalised phone", async () => {
      const repos = await getRepositories();
      const created = await repos.guests.create(businessId, {
        name: "Claire Fontaine",
        phone: "06 98 76 54 32",
        email: "claire.fontaine@example.com",
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe("Claire Fontaine");
      expect(created.phone).toBe("+33698765432");

      const found = await repos.guests.findById(businessId, created.id);
      expect(found?.phone).toBe("+33698765432");
    });

    it("update modifies guest details and throws on non-existent", async () => {
      const repos = await getRepositories();
      const existing = (await repos.guests.list(businessId))[0];

      const updated = await repos.guests.update(businessId, existing.id, {
        notes: "Updated loyalty tier notes",
      });
      expect(updated.notes).toBe("Updated loyalty tier notes");

      await expect(
        repos.guests.update(businessId, "00000000-0000-4000-8000-000000000099", {
          notes: "fail",
        }),
      ).rejects.toThrow();
    });

    it("enforces phone uniqueness per business on create and update", async () => {
      const repos = await getRepositories();
      const firstWithPhone = (await repos.guests.list(businessId)).find((g) => Boolean(g.phone))!;

      await expect(
        repos.guests.create(businessId, {
          name: "Duplicate Phone Guest",
          phone: firstWithPhone.phone,
        }),
      ).rejects.toThrow("already exists");
    });
  });
}
