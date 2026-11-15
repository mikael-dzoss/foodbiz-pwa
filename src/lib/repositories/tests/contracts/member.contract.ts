import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

export function describeMemberRepositoryContract(
  getRepositories: () => Promise<Repositories> | Repositories,
  businessId: string,
): void {
  describe("MemberRepository contract", () => {
    it("list returns members for business", async () => {
      const repos = await getRepositories();
      const members = await repos.members.list(businessId);
      expect(members.length).toBeGreaterThan(0);
      expect(members.every((m) => m.businessId === businessId)).toBe(true);
    });

    it("findById and findByUserId return member or null", async () => {
      const repos = await getRepositories();
      const first = (await repos.members.list(businessId))[0];

      const byId = await repos.members.findById(businessId, first.id);
      expect(byId?.id).toBe(first.id);

      const byUser = await repos.members.findByUserId(businessId, first.userId);
      expect(byUser?.id).toBe(first.id);

      const notFound = await repos.members.findById(
        businessId,
        "00000000-0000-4000-8000-000000000099",
      );
      expect(notFound).toBeNull();
    });

    it("add, updateRole and remove manage business membership", async () => {
      const repos = await getRepositories();
      const newUserId = "00000000-0000-4000-8000-000000000088";

      const added = await repos.members.add(businessId, {
        userId: newUserId,
        role: "staff",
      });
      expect(added.id).toBeDefined();
      expect(added.role).toBe("staff");

      const promoted = await repos.members.updateRole(businessId, added.id, "manager");
      expect(promoted.role).toBe("manager");

      await expect(
        repos.members.updateRole(businessId, "00000000-0000-4000-8000-000000000099", "staff"),
      ).rejects.toThrow();

      await repos.members.remove(businessId, added.id);
      const afterRemove = await repos.members.findById(businessId, added.id);
      expect(afterRemove).toBeNull();

      await expect(repos.members.remove(businessId, added.id)).rejects.toThrow();
    });

    it("findMembershipForUser returns membership and business summary for existing member", async () => {
      const repos = await getRepositories();
      const first = (await repos.members.list(businessId))[0];

      const membership = await repos.members.findMembershipForUser(first.userId);
      expect(membership).not.toBeNull();
      expect(membership?.member.id).toBe(first.id);
      expect(membership?.member.businessId).toBe(businessId);
      expect(membership?.member.role).toBe(first.role);
      expect(membership?.business.id).toBe(businessId);
      expect(membership?.business.currency).toBe("EUR");
      expect(typeof membership?.business.name).toBe("string");
      expect(typeof membership?.business.slug).toBe("string");
    });

    it("findMembershipForUser returns null for non-member user", async () => {
      const repos = await getRepositories();
      const nonMemberId = "00000000-0000-4000-8000-000000000077";
      const membership = await repos.members.findMembershipForUser(nonMemberId);
      expect(membership).toBeNull();
    });

    it("findMembershipForUser deterministically selects the earliest created membership when user has multiple memberships", async () => {
      const repos = await getRepositories();
      const multiUserId = "00000000-0000-4000-8000-000000000066";

      // First membership added with earlier ID and timestamp
      const firstAdded = await repos.members.add(businessId, {
        id: "10000000-0000-4000-8000-000000000001",
        userId: multiUserId,
        role: "staff",
      });

      await new Promise((resolve) => setTimeout(resolve, 15));

      // Second membership added (later in time, higher ID)
      const secondAdded = await repos.members.add(businessId, {
        id: "20000000-0000-4000-8000-000000000002",
        userId: multiUserId,
        role: "manager",
      });

      try {
        const found = await repos.members.findMembershipForUser(multiUserId);
        expect(found).not.toBeNull();
        // Deterministically returns the earliest created membership
        expect(found?.member.id).toBe(firstAdded.id);
        expect(found?.member.role).toBe("staff");
      } finally {
        await repos.members.remove(businessId, firstAdded.id);
        await repos.members.remove(businessId, secondAdded.id);
      }
    });
  });
}
