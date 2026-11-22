import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  BusinessTimeZoneProvider,
  useBusinessTimeZone,
  useZonedToday,
} from "../time/business-timezone";

function Probe() {
  const zone = useBusinessTimeZone();
  const today = useZonedToday(zone);
  return <p data-testid="probe">{`${zone}|${today ?? "pending"}`}</p>;
}

describe("business time zone context (#168)", () => {
  it("defaults to the business default zone without a provider", () => {
    expect(renderToString(<Probe />)).toContain("Europe/Paris|pending");
  });

  it("renders no clock value on the server, then today in the business zone on the client", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T22:30:00Z")); // 10 Oct in Paris, 9 Oct in New York
    try {
      expect(
        renderToString(
          <BusinessTimeZoneProvider timeZone="Europe/Paris">
            <Probe />
          </BusinessTimeZoneProvider>,
        ),
      ).toContain("Europe/Paris|pending");

      render(
        <BusinessTimeZoneProvider timeZone="America/New_York">
          <Probe />
        </BusinessTimeZoneProvider>,
      );
      expect(screen.getByTestId("probe").textContent).toBe("America/New_York|2026-10-09");
    } finally {
      vi.useRealTimers();
    }
  });
});
