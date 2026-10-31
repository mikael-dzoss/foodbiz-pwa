import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

export function describeBusinessRepositoryContract(
  getRepositories: () => Promise<Repositories> | Repositories,
  businessId: string,
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
      const notFoundSlug = await repos.business.findBySlug("non-existent-bakery");
      expect(notFoundSlug).toBeNull();
    });

    it("create adds a new business", async () => {
      const repos = await getRepositories();
      const created = await repos.business.create({
        name: "Artisan Bakery Paris",
        slug: "artisan-bakery-paris",
        instagramUrl: "https://instagram.com/artisan",
        facebookUrl: "https://facebook.com/artisan",
        tiktokUrl: "https://tiktok.com/@artisan",
      });
      expect(created.id).toBeDefined();
      expect(created.name).toBe("Artisan Bakery Paris");

      const found = await repos.business.findBySlug("artisan-bakery-paris");
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
        name: "La Grande Boulangerie",
      });
      expect(updated.name).toBe("La Grande Boulangerie");

      const fetched = await repos.business.findById(businessId);
      expect(fetched?.name).toBe("La Grande Boulangerie");

      await expect(
        repos.business.update("00000000-0000-4000-8000-000000000099", {
          name: "fail",
        }),
      ).rejects.toThrow();
    });

    it("update modifies profile contact and details", async () => {
      const repos = await getRepositories();
      const updated = await repos.business.update(businessId, {
        description: "New updated bakery description",
        phone: "+33 1 99 88 77 66",
        email: "contact@lapetiteboulangerie.fr",
        whatsappNumber: "+33 6 99 88 77 66",
        address: "50 Boulevard Voltaire, 75011 Paris",
      });
      expect(updated.description).toBe("New updated bakery description");
      expect(updated.phone).toBe("+33 1 99 88 77 66");
      expect(updated.email).toBe("contact@lapetiteboulangerie.fr");
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
      });
      expect(updatedSettings.lowStockThreshold).toBe(10);
      expect(updatedSettings.taxPercentage).toBe(10);

      const reFetched = await repos.business.getSettings(businessId);
      expect(reFetched?.lowStockThreshold).toBe(10);

      await expect(
        repos.business.updateSettings("00000000-0000-4000-8000-000000000099", {
          lowStockThreshold: 15,
        }),
      ).rejects.toThrow();
    });
  });
}
