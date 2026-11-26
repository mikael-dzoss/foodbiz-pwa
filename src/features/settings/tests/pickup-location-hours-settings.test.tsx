import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { enDictionary } from "@/domain/i18n";
import type { WeeklyHours } from "@/domain/opening-hours";
import { PickupLocationHoursSettings } from "../components/pickup-location-hours-settings";
import { updatePickupLocationAction } from "../pickup-location-actions";

vi.mock("../pickup-location-actions", () => ({ updatePickupLocationAction: vi.fn() }));

const updateMock = vi.mocked(updatePickupLocationAction);
const ID = "11111111-1111-4111-8111-111111111111";
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

function renderPage(initial: WeeklyHours | null) {
  return render(
    <ToastProvider>
      <PickupLocationHoursSettings
        locationId={ID}
        locationName="Relay A"
        initial={initial}
        locale="en"
      />
    </ToastProvider>,
  );
}

describe("PickupLocationHoursSettings (#385)", () => {
  beforeEach(() => {
    updateMock.mockReset();
    updateMock.mockResolvedValue({ ok: true, data: {} as never });
  });

  it("reuses the regular hours form with the pickup footer note and no holidays row", () => {
    renderPage(weekly);
    expect(screen.getByTestId("regular-hours-form")).toBeDefined();
    expect(screen.getByTestId("regular-hours-form-footer-note").textContent).toBe(
      "Shop closures and holidays apply to all pickup points",
    );
    expect(screen.queryByTestId("link-exceptions")).toBeNull();
    expect(screen.getByTestId("back-to-pickup-locations").getAttribute("href")).toBe(
      "/manage/settings/pickup-locations",
    );
    expect(screen.getByText("Relay A")).toBeDefined();
  });

  it("saves the weekly hours through the location update action", async () => {
    renderPage(weekly);
    fireEvent.click(screen.getByTestId("regular-hours-form-save"));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith({ id: ID, weeklyHours: weekly });
  });

  it("clears to null (same as shop hours) after confirmation", async () => {
    renderPage(weekly);
    fireEvent.click(screen.getByTestId("regular-hours-form-clear"));
    fireEvent.click(screen.getByTestId("regular-hours-form-clear-dialog-confirm"));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ id: ID, weeklyHours: null }));
    expect(
      await screen.findByText(enDictionary.settings.pickupLocations.clearSuccess),
    ).toBeDefined();
  });

  it("offers no clear button while the location follows the shop hours", () => {
    renderPage(null);
    expect(screen.queryByTestId("regular-hours-form-clear")).toBeNull();
  });
});
