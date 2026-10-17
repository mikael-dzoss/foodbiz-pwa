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

  it("renders Stitch C-01 open 2-row layout with accepting orders and closing time", () => {
    render(
      <StoreStatusBanner
        isAcceptingOrders={true}
        isOpen={true}
        dict={enDictionary.storefront}
        openingHoursText="07:30 - 19:30"
      />,
    );

    // Row 1: Open accepting orders + closing time
    expect(screen.getByText(enDictionary.storefront.openAcceptingOrders)).toBeDefined();
    expect(
      screen.getByText(new RegExp(`${enDictionary.storefront.closesAt}\\s*19:30`)),
    ).toBeDefined();

    // Row 2: Order ready time + pickup and delivery badge
    expect(screen.getByText(enDictionary.storefront.orderReadyTime)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.pickupAndDelivery)).toBeDefined();
  });

  it("renders Stitch C-01 closed 2-row layout with orders queued and opening time", () => {
    render(
      <StoreStatusBanner
        isAcceptingOrders={true}
        isOpen={false}
        dict={enDictionary.storefront}
        openingHoursText="07:30 - 19:30"
      />,
    );

    // Row 1: Closed orders queued + opening time
    expect(screen.getByText(enDictionary.storefront.closedOrdersQueued)).toBeDefined();
    expect(
      screen.getByText(new RegExp(`${enDictionary.storefront.opensAt}\\s*07:30`)),
    ).toBeDefined();

    // Row 2: Order ready time + pickup and delivery badge
    expect(screen.getByText(enDictionary.storefront.orderReadyTime)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.pickupAndDelivery)).toBeDefined();
  });
});
