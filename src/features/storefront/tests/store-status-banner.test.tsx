import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StoreStatusBanner } from "../components/store-status-banner";
import { enDictionary } from "@/domain/i18n";

describe("StoreStatusBanner (#82)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders role='alert' when store is not accepting orders", () => {
    render(
      <StoreStatusBanner
        isAcceptingOrders={false}
        isOpen={false}
        dict={enDictionary.storefront}
        openingHoursText="08:00 - 18:00"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.notAcceptingOrdersBanner)).toBeDefined();
    expect(screen.getByText(/08:00 - 18:00/)).toBeDefined();
  });

  it("renders role='status' with storeClosedBadge when store is closed but accepts scheduled orders", () => {
    render(
      <StoreStatusBanner
        isAcceptingOrders={true}
        isOpen={false}
        orderTimingScheduled={true}
        dict={enDictionary.storefront}
        openingHoursText="08:00 - 18:00"
      />,
    );

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.storeClosedBadge)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.storeClosedBanner)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.scheduledOnlyNotice)).toBeDefined();
  });

  it("renders open live status indicator when store is open and accepting orders", () => {
    render(
      <StoreStatusBanner
        isAcceptingOrders={true}
        isOpen={true}
        dict={enDictionary.storefront}
        openingHoursText="08:00 - 18:00"
      />,
    );

    expect(screen.getByText(enDictionary.storefront.storeOpenBadge)).toBeDefined();
    expect(screen.getByText("08:00 - 18:00")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
