import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRepositories } from "@/lib/repositories/mock";
import { demoGuests } from "@/lib/repositories/mock/fixtures/guests";
import { attachGuestNames } from "@/domain/order";
import { getCustomer, listCustomers } from "../customer-data";
import { updateCustomerAction } from "../customer-actions";

const { auth, revalidatePath } = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
}));
const repos = createMockRepositories();
vi.mock("@/lib/repositories", () => ({ getRepositories: () => repos }));
vi.mock("@/features/auth", () => ({ requireAuthenticatedAction: auth }));
vi.mock("next/cache", () => ({ revalidatePath }));

const guest = demoGuests[0];
const input = { id: guest.id, name: "  Alex   Martin ", notes: " Updated notes " };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  repos.reset();
  auth.mockResolvedValue({ businessId: guest.businessId });
});

describe("customer reads", () => {
  it("lists customer metrics and resolves history by guest ID, newest first", async () => {
    expect(await listCustomers()).toHaveLength(demoGuests.length);
    const detail = await getCustomer(guest.id);
    expect(detail?.summary.guest).toEqual(guest);
    expect(detail?.orders.length).toBeGreaterThan(0);
    expect(detail?.orders.every((o) => o.guestId === guest.id)).toBe(true);
    expect(detail?.orders.map((o) => o.createdAt)).toEqual(
      detail?.orders
        .map((o) => o.createdAt)
        .sort()
        .reverse(),
    );
  });

  it("does not expose guests from another business and handles missing or invalid IDs", async () => {
    expect(await getCustomer("bad")).toBeNull();
    expect(await getCustomer("44444444-4444-4444-8444-444444444499")).toBeNull();
    auth.mockResolvedValue({ businessId: "11111111-1111-4111-8111-999999999999" });
    expect(await listCustomers()).toEqual([]);
    expect(await getCustomer(guest.id)).toBeNull();
  });

  it("propagates authentication and repository failures instead of returning empty data", async () => {
    auth.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(listCustomers()).rejects.toThrow("Unauthorized");
    vi.spyOn(repos.guests, "list").mockRejectedValueOnce(new Error("Offline"));
    await expect(listCustomers()).rejects.toThrow("Offline");
  });
});

describe("canonical customer edits", () => {
  it("persists name and notes, resolves linked order names and preserves order audit data", async () => {
    const originalOrders = await repos.orders.list(guest.businessId, { guestId: guest.id });
    const result = await updateCustomerAction(input);
    expect(result).toMatchObject({
      success: true,
      data: { id: guest.id, name: "Alex Martin", notes: "Updated notes" },
    });
    const orders = await repos.orders.list(guest.businessId, { guestId: guest.id });
    const guests = await repos.guests.list(guest.businessId);
    expect(attachGuestNames(orders, guests).every((o) => o.guestName === "Alex Martin")).toBe(true);
    expect(orders).toEqual(originalOrders);
    expect(revalidatePath).toHaveBeenCalledWith("/manage", "layout");
  });

  it("rejects invalid input without modifying the guest", async () => {
    expect(await updateCustomerAction({ ...input, name: " " })).toMatchObject({
      success: false,
      error: "invalid",
      fieldErrors: { name: expect.any(Array) },
    });
    expect(await repos.guests.findById(guest.businessId, guest.id)).toEqual(guest);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rechecks auth and never updates another business's guest", async () => {
    auth.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(updateCustomerAction(input)).rejects.toThrow("Unauthorized");
    auth.mockResolvedValue({ businessId: "11111111-1111-4111-8111-999999999999" });
    expect(await updateCustomerAction(input)).toEqual({ success: false, error: "notFound" });
    expect(await repos.guests.findById(guest.businessId, guest.id)).toEqual(guest);
  });

  it("reports save failures without exposing repository internals or false success", async () => {
    vi.spyOn(repos.guests, "update").mockRejectedValueOnce(new Error("private database detail"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await updateCustomerAction(input)).toEqual({ success: false, error: "saveFailed" });
    expect(log).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
