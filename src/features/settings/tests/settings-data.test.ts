import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBusinessProfile,
  getBusinessSettings,
  getBusinessTimeZone,
  getBusinessToday,
} from "../settings-data";

const businessId = "11111111-1111-4111-8111-111111111111";
const repo = vi.hoisted(() => ({
  findById: vi.fn(),
  getSettings: vi.fn(),
}));
const auth = vi.hoisted(() => ({ requireAuthenticatedAction: vi.fn() }));
vi.mock("@/lib/repositories", () => ({ getRepositories: () => ({ business: repo }) }));
vi.mock("@/features/auth", () => auth);
vi.mock("@/lib/request-time", () => ({
  getRequestNow: vi.fn(async () => new Date("2026-10-09T22:30:00Z")),
}));

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

  it("returns the business time zone and 'today' on its calendar (#168)", async () => {
    repo.getSettings.mockResolvedValue({ businessId, timezone: "Europe/Paris" });
    // 22:30 UTC on 9 Oct is 00:30 on the 10th in Paris
    expect(await getBusinessToday()).toBe("2026-10-10");
    repo.getSettings.mockResolvedValue({ businessId, timezone: "America/New_York" });
    expect(await getBusinessToday()).toBe("2026-10-09");
  });

  it("falls back to the default zone before the first settings save (#168)", async () => {
    repo.getSettings.mockResolvedValueOnce(null);
    expect(await getBusinessTimeZone()).toBe("Europe/Paris");
  });
});
