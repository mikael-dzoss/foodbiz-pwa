import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBusinessProfile, getBusinessSettings } from "../settings-data";

const businessId = "11111111-1111-4111-8111-111111111111";
const repo = vi.hoisted(() => ({
  findById: vi.fn(),
  getSettings: vi.fn(),
}));
const auth = vi.hoisted(() => ({ requireAuthenticatedAction: vi.fn() }));
vi.mock("@/lib/repositories", () => ({ getRepositories: () => ({ business: repo }) }));
vi.mock("@/features/auth", () => auth);

beforeEach(() => {
  vi.resetAllMocks();
  auth.requireAuthenticatedAction.mockResolvedValue({ businessId });
});

describe("settings data", () => {
  it("returns the business profile", async () => {
    repo.findById.mockResolvedValue({ id: businessId, name: "Bakery" });
    expect(await getBusinessProfile()).toMatchObject({ name: "Bakery" });
    expect(repo.findById).toHaveBeenCalledWith(businessId);
  });

  it("throws when the business is missing or the read fails (route error state)", async () => {
    repo.findById.mockResolvedValueOnce(null);
    await expect(getBusinessProfile()).rejects.toThrow("Business not found");
    repo.findById.mockRejectedValueOnce(new Error("Offline"));
    await expect(getBusinessProfile()).rejects.toThrow("Offline");
  });

  it("returns stored settings, or defaults before the first save", async () => {
    repo.getSettings.mockResolvedValueOnce({ businessId, lowStockThreshold: 9 });
    expect(await getBusinessSettings()).toMatchObject({ lowStockThreshold: 9 });
    repo.getSettings.mockResolvedValueOnce(null);
    expect(await getBusinessSettings()).toMatchObject({ businessId, lowStockThreshold: 5 });
  });

  it("throws on read failure instead of falling back to defaults", async () => {
    repo.getSettings.mockRejectedValueOnce(new Error("Offline"));
    await expect(getBusinessSettings()).rejects.toThrow("Offline");
  });
});
