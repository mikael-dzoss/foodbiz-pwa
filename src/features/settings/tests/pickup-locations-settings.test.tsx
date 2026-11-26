import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { enDictionary } from "@/domain/i18n";
import type { WeeklyHours } from "@/domain/opening-hours";
import type { PickupLocation } from "@/domain/pickup-location";
import { DEMO_BUSINESS_ID } from "@/lib/repositories/mock";
import { PickupLocationsSettings } from "../components/pickup-locations-settings";
import {
  createPickupLocationAction,
  deletePickupLocationAction,
  reorderPickupLocationsAction,
  setShopPickupEnabledAction,
  updatePickupLocationAction,
} from "../pickup-location-actions";

vi.mock("../pickup-location-actions", () => ({
  createPickupLocationAction: vi.fn(),
  updatePickupLocationAction: vi.fn(),
  deletePickupLocationAction: vi.fn(),
  reorderPickupLocationsAction: vi.fn(),
  setShopPickupEnabledAction: vi.fn(),
}));

const createMock = vi.mocked(createPickupLocationAction);
const updateMock = vi.mocked(updatePickupLocationAction);
const deleteMock = vi.mocked(deletePickupLocationAction);
const reorderMock = vi.mocked(reorderPickupLocationsAction);
const shopMock = vi.mocked(setShopPickupEnabledAction);

const range = [{ open: "09:00", close: "17:00" }];
const weekly: WeeklyHours = {
  mon: range,
  tue: range,
  wed: range,
  thu: range,
  fri: range,
  sat: [],
  sun: [],
};

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function location(overrides: Partial<PickupLocation> & Pick<PickupLocation, "id">): PickupLocation {
  return {
    businessId: DEMO_BUSINESS_ID,
    name: "Relay",
    description: null,
    address: "1 rue A",
    postcode: "75001",
    feeCents: 0,
    weeklyHours: null,
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const relayA = location({ id: A, name: "Relay A", feeCents: 250, weeklyHours: weekly });
const relayB = location({ id: B, name: "Relay B", isActive: false, sortOrder: 1 });

function renderPage(initial: PickupLocation[] = [relayA, relayB], shopPickupEnabled = true) {
  return render(
    <ToastProvider>
      <PickupLocationsSettings
        shop={{ name: "Chez Foodbiz", address: "5 rue Centrale" }}
        shopPickupEnabled={shopPickupEnabled}
        initial={initial}
        locale="en"
      />
    </ToastProvider>,
  );
}

const lastOptionRefusal = {
  ok: false as const,
  code: "CONFLICT" as const,
  message: "refused",
  reason: "LAST_PICKUP_OPTION",
};
const refusalText = enDictionary.common.actionReasons.LAST_PICKUP_OPTION;

describe("PickupLocationsSettings (#385)", () => {
  beforeEach(() => {
    for (const mock of [createMock, updateMock, deleteMock, reorderMock, shopMock]) {
      mock.mockReset();
    }
  });

  it("renders the shop row first, then fee/Free, hours summary and the inactive badge", () => {
    renderPage();
    const shopRow = within(screen.getByTestId("pickup-shop-list")).getByRole("listitem");
    expect(shopRow.getAttribute("data-testid")).toBe("pickup-shop-row");
    expect(shopRow.textContent).toContain("Chez Foodbiz");
    expect(screen.getByRole("heading", { name: "Relay locations" })).toBeDefined();
    expect(
      (screen.getByTestId("switch-shop-pickup") as HTMLElement).getAttribute("aria-checked"),
    ).toBe("true");
    const a = screen.getByTestId(`pickup-location-row-${A}`);
    expect(a.textContent).toContain("1 rue A, 75001");
    expect(screen.getByTestId(`pickup-location-fee-${A}`).textContent).toContain("2.50");
    expect(screen.getByTestId(`pickup-location-hours-${A}`).textContent).toContain("09:00");
    expect(within(a).queryByText("Inactive")).toBeNull();
    expect(screen.getByTestId(`pickup-location-fee-${B}`).textContent).toBe("Free");
    expect(screen.getByTestId(`pickup-location-hours-${B}`).textContent).toBe("Same as shop hours");
    expect(screen.getByTestId(`pickup-location-inactive-${B}`).textContent).toBe("Inactive");
  });

  it("shows the empty state without relay locations", () => {
    renderPage([]);
    expect(screen.getByTestId("pickup-locations-empty")).toBeDefined();
    expect(screen.getByTestId("pickup-shop-row")).toBeDefined();
  });

  it("adds a location from the sheet and appends it to the list", async () => {
    const created = location({ id: A, name: "New relay", feeCents: 150, sortOrder: 0 });
    createMock.mockResolvedValue({ ok: true, data: created });
    renderPage([]);
    fireEvent.click(screen.getByTestId("pickup-location-add"));
    expect(screen.getByTestId("pickup-location-hours-hint")).toBeDefined();
    fireEvent.change(screen.getByTestId("pickup-location-name"), {
      target: { value: "New relay" },
    });
    fireEvent.change(screen.getByTestId("pickup-location-address"), {
      target: { value: "2 rue B" },
    });
    fireEvent.change(screen.getByTestId("pickup-location-postcode"), {
      target: { value: "75002" },
    });
    fireEvent.change(screen.getByTestId("pickup-location-fee"), { target: { value: "1,5" } });
    fireEvent.click(screen.getByTestId("pickup-location-save"));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith({
      name: "New relay",
      description: null,
      address: "2 rue B",
      postcode: "75002",
      feeCents: 150,
      isActive: true,
    });
    await waitFor(() => expect(screen.getByTestId(`pickup-location-row-${A}`)).toBeDefined());
    // Stays open in edit mode so "Edit hours" is reachable right away.
    expect(screen.getByTestId("pickup-location-edit-hours")).toBeDefined();
  });

  it("blocks invalid input with localized field errors", () => {
    renderPage([]);
    fireEvent.click(screen.getByTestId("pickup-location-add"));
    fireEvent.change(screen.getByTestId("pickup-location-postcode"), { target: { value: "12" } });
    fireEvent.click(screen.getByTestId("pickup-location-save"));
    expect(createMock).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a name")).toBeDefined();
    expect(screen.getByText("Enter an address")).toBeDefined();
    expect(screen.getByText("Postcode must be 5 digits")).toBeDefined();
  });

  it("edits a location, shows read-only hours and links to the hours sub-page", async () => {
    updateMock.mockResolvedValue({ ok: true, data: { ...relayA, name: "Renamed" } });
    renderPage();
    fireEvent.click(screen.getByTestId(`pickup-location-edit-${A}`));
    expect(screen.getByTestId("pickup-location-hours-summary")).toBeDefined();
    expect(screen.getByTestId("pickup-location-edit-hours").getAttribute("href")).toBe(
      `/manage/settings/pickup-locations/${A}/hours`,
    );
    fireEvent.change(screen.getByTestId("pickup-location-name"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByTestId("pickup-location-save"));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][0]).toMatchObject({ id: A, name: "Renamed", feeCents: 250 });
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty("weeklyHours");
    await waitFor(() => expect(screen.getByText("Renamed")).toBeDefined());
  });

  it("shows 'Same as shop hours' in the sheet when the location has no hours of its own", () => {
    renderPage();
    fireEvent.click(screen.getByTestId(`pickup-location-edit-${B}`));
    expect(screen.getByTestId("pickup-location-hours-shop").textContent).toBe("Same as shop hours");
  });

  it("shows the localized reason inline and keeps the sheet open when deactivation is refused", async () => {
    updateMock.mockResolvedValue(lastOptionRefusal);
    renderPage([relayA], false);
    fireEvent.click(screen.getByTestId(`pickup-location-edit-${A}`));
    fireEvent.click(screen.getByTestId("pickup-location-active"));
    fireEvent.click(screen.getByTestId("pickup-location-save"));
    expect((await screen.findByTestId("pickup-location-form-error")).textContent).toContain(
      refusalText,
    );
    expect(screen.getByTestId("pickup-location-sheet")).toBeDefined();
  });

  it("deletes after confirmation", async () => {
    deleteMock.mockResolvedValue({ ok: true, data: undefined });
    renderPage();
    fireEvent.click(screen.getByTestId(`pickup-location-edit-${A}`));
    fireEvent.click(screen.getByTestId("pickup-location-delete"));
    fireEvent.click(screen.getByTestId("pickup-location-delete-dialog-cancel"));
    expect(deleteMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("pickup-location-delete"));
    fireEvent.click(screen.getByTestId("pickup-location-delete-dialog-confirm"));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith({ id: A }));
    await waitFor(() => expect(screen.queryByTestId(`pickup-location-row-${A}`)).toBeNull());
  });

  it("shows the refusal when deleting the last pickup option", async () => {
    deleteMock.mockResolvedValue(lastOptionRefusal);
    renderPage([relayA], false);
    fireEvent.click(screen.getByTestId(`pickup-location-edit-${A}`));
    fireEvent.click(screen.getByTestId("pickup-location-delete"));
    fireEvent.click(screen.getByTestId("pickup-location-delete-dialog-confirm"));
    expect((await screen.findByTestId("pickup-location-form-error")).textContent).toContain(
      refusalText,
    );
    expect(screen.getByTestId(`pickup-location-row-${A}`)).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId("pickup-location-form-error")),
    );
  });

  it("reorders with the move buttons and disables the edges", async () => {
    reorderMock.mockResolvedValue({
      ok: true,
      data: [
        { ...relayB, sortOrder: 0 },
        { ...relayA, sortOrder: 1 },
      ],
    });
    renderPage();
    expect((screen.getByTestId(`pickup-location-up-${A}`) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByTestId(`pickup-location-down-${B}`) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByTestId(`pickup-location-down-${A}`));
    await waitFor(() => expect(reorderMock).toHaveBeenCalledWith({ ids: [B, A] }));
    await waitFor(() => {
      const rows = within(screen.getByTestId("pickup-locations-list")).getAllByRole("listitem");
      expect(rows[0].getAttribute("data-testid")).toBe(`pickup-location-row-${B}`);
    });
    expect(screen.getByTestId("pickup-locations-announcement").textContent).toBe(
      "Relay A moved to position 2 of 2",
    );
    // A now sits at the bottom edge, so focus moves to its up button.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId(`pickup-location-up-${A}`)),
    );
  });

  it("ignores move clicks while busy (aria-disabled guard)", async () => {
    let resolve: (
      value: Awaited<ReturnType<typeof reorderPickupLocationsAction>>,
    ) => void = () => {};
    reorderMock.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage();
    fireEvent.click(screen.getByTestId(`pickup-location-down-${A}`));
    const up = screen.getByTestId(`pickup-location-up-${B}`);
    await waitFor(() => expect(up.getAttribute("aria-disabled")).toBe("true"));
    fireEvent.click(up);
    expect(reorderMock).toHaveBeenCalledTimes(1);
    resolve({ ok: true, data: [relayB, relayA] });
  });

  it("explains when pickup is off in Ordering settings and keeps the list editable", () => {
    render(
      <ToastProvider>
        <PickupLocationsSettings
          shop={{ name: "Chez Foodbiz", address: null }}
          shopPickupEnabled
          pickupServiceEnabled={false}
          initial={[relayA]}
          locale="en"
        />
      </ToastProvider>,
    );
    expect(screen.getByTestId("pickup-service-off-notice").textContent).toContain(
      "Pickup is turned off in Ordering settings",
    );
    expect(screen.getByTestId(`pickup-location-edit-${A}`)).toBeDefined();
  });

  it("hints the 20-location limit and ties it to the disabled Add button", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      location({
        id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        name: `R${i}`,
        sortOrder: i,
      }),
    );
    renderPage(many);
    const add = screen.getByTestId("pickup-location-add") as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(add.getAttribute("aria-describedby")).toBe("pickup-locations-limit");
    expect(screen.getByTestId("pickup-locations-limit").textContent).toBe("20 locations maximum");
  });

  it("names the location in the delete dialog and refocuses Add after deleting", async () => {
    deleteMock.mockResolvedValue({ ok: true, data: undefined });
    renderPage();
    fireEvent.click(screen.getByTestId(`pickup-location-edit-${A}`));
    fireEvent.click(screen.getByTestId("pickup-location-delete"));
    expect(screen.getByText("Delete Relay A?")).toBeDefined();
    fireEvent.click(screen.getByTestId("pickup-location-delete-dialog-confirm"));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId("pickup-location-add")),
    );
  });

  it("turns shop pickup off", async () => {
    shopMock.mockResolvedValue({ ok: true, data: {} as never });
    renderPage();
    fireEvent.click(screen.getByTestId("switch-shop-pickup"));
    await waitFor(() => expect(shopMock).toHaveBeenCalledWith({ enabled: false }));
    expect(screen.getByTestId("switch-shop-pickup").getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByTestId("pickup-locations-error")).toBeNull();
  });

  it("reverts the shop switch and explains when LAST_PICKUP_OPTION refuses", async () => {
    shopMock.mockResolvedValue(lastOptionRefusal);
    renderPage([relayB]);
    fireEvent.click(screen.getByTestId("switch-shop-pickup"));
    expect((await screen.findByTestId("pickup-shop-error")).textContent).toContain(refusalText);
    const shopSwitch = screen.getByTestId("switch-shop-pickup");
    expect(shopSwitch.getAttribute("aria-checked")).toBe("true");
    expect(shopSwitch.getAttribute("aria-describedby")).toBe("pickup-shop-error");
    await waitFor(() => expect(document.activeElement).toBe(shopSwitch));
  });
});
