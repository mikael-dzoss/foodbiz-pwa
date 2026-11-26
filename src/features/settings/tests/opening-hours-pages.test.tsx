import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpeningHoursOverview } from "../components/opening-hours-overview";
import { RegularHoursSettings } from "../components/regular-hours-settings";
import { demoSettings } from "@/lib/repositories/mock/fixtures";
import type { BusinessSettings } from "@/domain/business";
import type { WeeklyHours } from "@/domain/opening-hours";

vi.mock("../actions", () => ({ updateOpeningHoursAction: vi.fn() }));

const range = [{ open: "09:00", close: "17:00" }];
const weekly: WeeklyHours = {
  mon: [],
  tue: range,
  wed: range,
  thu: range,
  fri: range,
  sat: range,
  sun: range,
};

const NOW = new Date("2026-12-01T10:00:00Z");

const settings: BusinessSettings = { ...demoSettings, weeklyHours: weekly, hoursExceptions: [] };

describe("OpeningHoursOverview (#372)", () => {
  it("shows the grouped summary and links to regular hours", () => {
    render(<OpeningHoursOverview settings={settings} locale="en" now={NOW} />);
    expect(screen.getByRole("heading", { level: 1, name: "Opening hours" })).toBeDefined();
    expect(screen.getByTestId("hours-summary-weekly")).toBeDefined();
    expect(screen.getByTestId("link-regular-hours").getAttribute("href")).toBe(
      "/manage/settings/opening-hours/regular",
    );
    expect(screen.getByText("Structured hours active")).toBeDefined();
  });

  it("links to holidays & exceptional days and counts upcoming ones", () => {
    const withException: BusinessSettings = {
      ...settings,
      hoursExceptions: [{ from: "2026-12-25", to: "2026-12-25", ranges: [] }],
    };
    render(<OpeningHoursOverview settings={withException} locale="en" now={NOW} />);
    const link = screen.getByTestId("link-exceptions");
    expect(link.getAttribute("href")).toBe("/manage/settings/opening-hours/exceptions");
    expect(link.textContent).toContain("1 upcoming");
    expect(screen.getByTestId("hours-summary-exception-2026-12-25")).toBeDefined();
  });

  it("shows the legacy text and a hint when weekly hours are not set", () => {
    render(
      <OpeningHoursOverview
        settings={{ ...settings, weeklyHours: null, openingHours: "Daily 8-18" }}
        locale="en"
        now={NOW}
      />,
    );
    expect(screen.getByTestId("hours-summary-fallback").textContent).toBe("Daily 8-18");
    expect(screen.getByText("Not set yet")).toBeDefined();
  });
});

describe("RegularHoursSettings (#372)", () => {
  it("renders back link, title and the form", () => {
    render(<RegularHoursSettings initial={weekly} locale="en" />);
    expect(screen.getByTestId("back-to-opening-hours").getAttribute("href")).toBe(
      "/manage/settings/opening-hours",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Regular hours" })).toBeDefined();
    expect(screen.getByTestId("regular-hours-form")).toBeDefined();
    expect(screen.getByTestId("regular-hours-form-clear")).toBeDefined();
  });
});
