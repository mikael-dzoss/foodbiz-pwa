import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HoursSummary } from "../components/opening-hours/hours-summary";
import type { HoursException, WeeklyHours } from "@/domain/opening-hours";
import { enDictionary, frDictionary } from "@/domain/i18n";

const demoWeekly: WeeklyHours = {
  mon: [],
  tue: [
    { open: "11:30", close: "14:30" },
    { open: "18:00", close: "22:00" },
  ],
  wed: [
    { open: "11:30", close: "14:30" },
    { open: "18:00", close: "22:00" },
  ],
  thu: [
    { open: "11:30", close: "14:30" },
    { open: "18:00", close: "22:00" },
  ],
  fri: [
    { open: "11:30", close: "14:30" },
    { open: "18:00", close: "24:00" },
  ],
  sat: [
    { open: "00:00", close: "01:00" },
    { open: "11:30", close: "15:00" },
  ],
  sun: [{ open: "12:00", close: "16:00" }],
};

const enLabels = {
  closed: enDictionary.settings.openingHours.closed,
  emptyTitle: enDictionary.settings.openingHours.emptyTitle,
  emptyHint: enDictionary.settings.openingHours.emptyHint,
  legacyTextLabel: enDictionary.settings.openingHours.legacyTextLabel,
  upcomingExceptionsTitle: enDictionary.settings.openingHours.upcomingExceptionsTitle,
  todayBadge: enDictionary.storefront.today,
};

const frLabels = {
  closed: frDictionary.settings.openingHours.closed,
  emptyTitle: frDictionary.settings.openingHours.emptyTitle,
  emptyHint: frDictionary.settings.openingHours.emptyHint,
  legacyTextLabel: frDictionary.settings.openingHours.legacyTextLabel,
  upcomingExceptionsTitle: frDictionary.settings.openingHours.upcomingExceptionsTitle,
  todayBadge: frDictionary.storefront.today,
};

describe("HoursSummary (#372, #375)", () => {
  it("groups consecutive days, joins overnight ranges with (+1), and marks closed days", () => {
    render(<HoursSummary weekly={demoWeekly} locale="en" labels={enLabels} />);

    const monRow = screen.getByTestId("hours-summary-row-mon");
    expect(monRow.textContent).toContain("Monday");
    expect(monRow.textContent).toContain("Closed");

    const tueRow = screen.getByTestId("hours-summary-row-tue");
    expect(tueRow.textContent).toContain("Tue–Thu");
    expect(tueRow.textContent).toContain("11:30–14:30 · 18:00–22:00");

    const friRow = screen.getByTestId("hours-summary-row-fri");
    expect(friRow.textContent).toContain("Friday");
    expect(friRow.textContent).toContain("11:30–14:30 · 18:00–01:00 (+1)");

    const satRow = screen.getByTestId("hours-summary-row-sat");
    expect(satRow.textContent).toContain("Saturday");
    expect(satRow.textContent).toContain("11:30–15:00");
    expect(satRow.textContent).not.toContain("00:00");
  });

  it("renders French localized grouped day labels and Closed text", () => {
    render(<HoursSummary weekly={demoWeekly} locale="fr" labels={frLabels} />);

    expect(screen.getByTestId("hours-summary-row-mon").textContent).toContain("Lundi");
    expect(screen.getByTestId("hours-summary-row-mon").textContent).toContain("Fermé");
    expect(screen.getByTestId("hours-summary-row-tue").textContent).toContain("Mar.–jeu.");
  });

  it("renders upcoming exceptions (date, range, closed, custom hours, note) and filters out past ones", () => {
    const exceptions: HoursException[] = [
      { from: "2026-07-01", to: "2026-07-02", ranges: [], note: "Past closure" },
      {
        from: "2026-08-15",
        to: "2026-08-15",
        ranges: [{ open: "11:00", close: "15:00" }],
        note: "Assomption — déjeuner uniquement",
      },
      { from: "2026-07-30", to: "2026-08-03", ranges: [], note: "Congés annuels" },
    ];

    render(
      <HoursSummary
        weekly={demoWeekly}
        exceptions={exceptions}
        locale="en"
        labels={enLabels}
        showExceptions
        timeZone="Europe/Paris"
        now={new Date("2026-07-20T10:00:00Z")}
      />,
    );

    const exSection = screen.getByTestId("hours-summary-exceptions");
    expect(within(exSection).queryByText("Past closure")).toBeNull();

    const items = within(exSection).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    // Sorted ascending: 30 Jul – 3 Aug comes first
    expect(items[0].textContent).toContain("30 Jul 2026 – 3 Aug 2026");
    expect(items[0].textContent).toContain("Closed");
    expect(items[0].textContent).toContain("Congés annuels");

    // Single day custom hours
    expect(items[1].textContent).toContain("15 Aug 2026");
    expect(items[1].textContent).toContain("11:00–15:00");
    expect(items[1].textContent).toContain("Assomption — déjeuner uniquement");
  });

  it("hides exceptions when showExceptions is false", () => {
    render(
      <HoursSummary
        weekly={demoWeekly}
        exceptions={[{ from: "2026-08-01", to: "2026-08-02", ranges: [], note: "Holiday" }]}
        locale="en"
        labels={enLabels}
        showExceptions={false}
        now={new Date("2026-07-20T10:00:00Z")}
      />,
    );

    expect(screen.queryByTestId("hours-summary-exceptions")).toBeNull();
  });

  it("renders legacy free text with hint when weekly is null and fallbackText exists", () => {
    render(
      <HoursSummary
        weekly={null}
        fallbackText="Tue–Sun 11:00–21:00"
        locale="en"
        labels={enLabels}
      />,
    );

    expect(screen.getByTestId("hours-summary-fallback").textContent).toBe("Tue–Sun 11:00–21:00");
    expect(screen.getByText(enLabels.emptyHint)).toBeDefined();
    expect(screen.queryByTestId("hours-summary-weekly")).toBeNull();
  });

  it("renders empty title and hint when weekly is null and fallbackText is blank", () => {
    render(<HoursSummary weekly={null} fallbackText="   " locale="en" labels={enLabels} />);

    expect(screen.getByText(enLabels.emptyTitle)).toBeDefined();
    expect(screen.getByText(enLabels.emptyHint)).toBeDefined();
    expect(screen.queryByTestId("hours-summary-fallback")).toBeNull();
  });

  it("highlights today's group with the Today badge when highlightToday is true", () => {
    // 2026-07-22 is a Wednesday (falls inside Tue–Thu group)
    render(
      <HoursSummary
        weekly={demoWeekly}
        locale="en"
        labels={enLabels}
        highlightToday
        timeZone="Europe/Paris"
        now={new Date("2026-07-22T10:00:00Z")}
      />,
    );

    const tueRow = screen.getByTestId("hours-summary-row-tue");
    expect(within(tueRow).getByTestId("hours-summary-today-badge").textContent).toBe("Today");
  });
});
