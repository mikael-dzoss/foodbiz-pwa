import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

export function describeBusinessRepositoryContract(
  getRepositories: () => Promise<Repositories> | Repositories,
  businessId: string,
  getNonOwnerRepositories?: () => Promise<Repositories> | Repositories,
): void {
  describe("BusinessRepository contract", () => {
    it("findById and findBySlug return business or null", async () => {
      const repos = await getRepositories();
      const b = await repos.business.findById(businessId);
      expect(b).not.toBeNull();
      expect(b?.id).toBe(businessId);

      const bySlug = await repos.business.findBySlug(b!.slug);
      expect(bySlug).not.toBeNull();
      expect(bySlug?.id).toBe(businessId);

      const notFound = await repos.business.findById("00000000-0000-4000-8000-000000000099");
      expect(notFound).toBeNull();
      const notFoundSlug = await repos.business.findBySlug("non-existent-shop");
      expect(notFoundSlug).toBeNull();
    });

    it("create adds a new business", async () => {
      const repos = await getRepositories();
      const created = await repos.business.create({
        name: "Artisan Kitchen Paris",
        slug: "artisan-kitchen-paris",
        instagramUrl: "https://instagram.com/artisan",
        facebookUrl: "https://facebook.com/artisan",
        tiktokUrl: "https://tiktok.com/@artisan",
      });
      expect(created.id).toBeDefined();
      expect(created.name).toBe("Artisan Kitchen Paris");

      const found = await repos.business.findBySlug("artisan-kitchen-paris");
      expect(found?.id).toBe(created.id);
      expect(found?.instagramUrl).toBe("https://instagram.com/artisan");
      expect(found?.facebookUrl).toBe("https://facebook.com/artisan");
      expect(found?.tiktokUrl).toBe("https://tiktok.com/@artisan");
      await repos.business.update(created.id, { instagramUrl: "", facebookUrl: "", tiktokUrl: "" });
      expect(await repos.business.findById(created.id)).toMatchObject({
        instagramUrl: "",
        facebookUrl: "",
        tiktokUrl: "",
      });
    });

    it("update modifies business name and updatedAt, and throws on unknown id", async () => {
      const repos = await getRepositories();
      const updated = await repos.business.update(businessId, {
        name: "Les Grandes Saveurs",
      });
      expect(updated.name).toBe("Les Grandes Saveurs");

      const fetched = await repos.business.findById(businessId);
      expect(fetched?.name).toBe("Les Grandes Saveurs");

      await expect(
        repos.business.update("00000000-0000-4000-8000-000000000099", {
          name: "fail",
        }),
      ).rejects.toThrow();
    });

    it("update modifies profile contact and details", async () => {
      const repos = await getRepositories();
      const updated = await repos.business.update(businessId, {
        description: "New updated kitchen description",
        phone: "+33 1 99 88 77 66",
        email: "contact@example.com",
        whatsappNumber: "+33 6 99 88 77 66",
        address: "50 Boulevard Voltaire, 75011 Paris",
      });
      expect(updated.description).toBe("New updated kitchen description");
      expect(updated.phone).toBe("+33 1 99 88 77 66");
      expect(updated.email).toBe("contact@example.com");
      expect(updated.whatsappNumber).toBe("+33 6 99 88 77 66");
      expect(updated.address).toBe("50 Boulevard Voltaire, 75011 Paris");
    });

    it("getSettings returns business settings and updateSettings modifies them, throwing on wrong businessId", async () => {
      const repos = await getRepositories();
      const settings = await repos.business.getSettings(businessId);
      expect(settings).not.toBeNull();
      expect(settings?.businessId).toBe(businessId);

      const updatedSettings = await repos.business.updateSettings(businessId, {
        lowStockThreshold: 10,
        taxPercentage: 10,
        paymentMethods: { cash: true, card: true, revolut: true, wero: true },
      });
      expect(updatedSettings.lowStockThreshold).toBe(10);
      expect(updatedSettings.taxPercentage).toBe(10);
      expect(updatedSettings.paymentMethods.card).toBe(true);

      const reFetched = await repos.business.getSettings(businessId);
      expect(reFetched?.lowStockThreshold).toBe(10);
      expect(reFetched?.paymentMethods.card).toBe(true);

      await repos.business.updateSettings(businessId, {
        paymentMethods: settings!.paymentMethods,
      });

      await expect(
        repos.business.updateSettings("00000000-0000-4000-8000-000000000099", {
          lowStockThreshold: 15,
        }),
      ).rejects.toThrow();
    });

    it("round-trips weeklyHours on updateSettings and clears it back to null", async () => {
      const repos = await getRepositories();
      const before = await repos.business.getSettings(businessId);
      expect(before?.weeklyHours).toBeNull();

      const sampleHours = {
        mon: [],
        tue: [
          { open: "11:30", close: "14:30" },
          { open: "18:00", close: "22:00" },
        ],
        wed: [{ open: "11:30", close: "14:30" }],
        thu: [{ open: "11:30", close: "14:30" }],
        fri: [
          { open: "11:30", close: "14:30" },
          { open: "18:00", close: "24:00" },
        ],
        sat: [
          { open: "00:00", close: "01:00" },
          { open: "11:30", close: "15:00" },
        ],
        sun: [],
      };

      const saved = await repos.business.updateSettings(businessId, {
        weeklyHours: sampleHours,
      });
      expect(saved.weeklyHours).toEqual(sampleHours);
      expect(saved.openingHours).toBe(before?.openingHours);

      const refetched = await repos.business.getSettings(businessId);
      expect(refetched?.weeklyHours).toEqual(sampleHours);

      const cleared = await repos.business.updateSettings(businessId, {
        weeklyHours: null,
      });
      expect(cleared.weeklyHours).toBeNull();

      const refetchedCleared = await repos.business.getSettings(businessId);
      expect(refetchedCleared?.weeklyHours).toBeNull();
    });

    it.runIf(Boolean(getNonOwnerRepositories))(
      "a member who is not an owner cannot change payment settings or the slug (FORBIDDEN)",
      async () => {
        const repos = await getRepositories();
        const nonOwner = await getNonOwnerRepositories!();
        const before = (await repos.business.findById(businessId))!;
        const settingsBefore = (await repos.business.getSettings(businessId))!;

        for (const change of [
          { revolutRevtag: "@intruder" },
          { weroIdentifier: "intruder-wero" },
          { paymentMethods: { cash: true, card: false, revolut: false, wero: false } },
          { paymentInstructionsEn: "Pay the intruder" },
          { paymentInstructionsFr: "Payez l'intrus" },
        ]) {
          await expect(nonOwner.business.updateSettings(businessId, change)).rejects.toMatchObject({
            code: "FORBIDDEN",
          });
        }
        await expect(
          nonOwner.business.update(businessId, { slug: "intruder-slug" }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });

        // Nothing changed.
        const settingsAfter = (await repos.business.getSettings(businessId))!;
        expect(settingsAfter.revolutRevtag).toBe(settingsBefore.revolutRevtag);
        expect(settingsAfter.paymentMethods).toEqual(settingsBefore.paymentMethods);
        expect((await repos.business.findById(businessId))!.slug).toBe(before.slug);

        // Everything else stays open to every member, and writing a protected value back unchanged is fine.
        const okSettings = await nonOwner.business.updateSettings(businessId, {
          lowStockThreshold: 8,
          revolutRevtag: settingsBefore.revolutRevtag,
        });
        expect(okSettings.lowStockThreshold).toBe(8);
        const okBusiness = await nonOwner.business.update(businessId, {
          description: "Updated by a non-owner",
          slug: before.slug,
        });
        expect(okBusiness.description).toBe("Updated by a non-owner");

        // The owner can.
        const ownerUpdate = await repos.business.updateSettings(businessId, {
          revolutRevtag: "@owner-change",
        });
        expect(ownerUpdate.revolutRevtag).toBe("@owner-change");
        await repos.business.updateSettings(businessId, {
          revolutRevtag: settingsBefore.revolutRevtag,
        });
      },
    );
  });
}
