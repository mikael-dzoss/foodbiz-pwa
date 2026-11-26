import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  WeeklyHoursEditor,
  createDefaultWeeklyHours,
  detectPresetMode,
} from "../components/opening-hours/weekly-hours-editor";
import type { WeeklyHours } from "@/domain/opening-hours";
import { enDictionary, frDictionary } from "@/domain/i18n";

function ControlledEditor({
  initial,
  locale = "en",
  onChangeSpy,
}: {
  initial: WeeklyHours;
  locale?: "en" | "fr";
  onChangeSpy?: (next: WeeklyHours) => void;
}) {
  const [value, setValue] = useState<WeeklyHours>(initial);
  return (
    <WeeklyHoursEditor
      value={value}
      locale={locale}
      onChange={(next) => {
        setValue(next);
        onChangeSpy?.(next);
      }}
    />
  );
}

describe("WeeklyHoursEditor (#372)", () => {
  it("detects initial preset mode from per-day data", () => {
    expect(detectPresetMode(createDefaultWeeklyHours())).toBe("every_day");
    expect(
      detectPresetMode({
        mon: [{ open: "09:00", close: "18:00" }],
        tue: [{ open: "09:00", close: "18:00" }],
        wed: [{ open: "09:00", close: "18:00" }],
        thu: [{ open: "09:00", close: "18:00" }],
        fri: [{ open: "09:00", close: "18:00" }],
        sat: [{ open: "10:00", close: "14:00" }],
        sun: [{ open: "10:00", close: "14:00" }],
      }),
    ).toBe("weekdays_weekend");
    expect(
      detectPresetMode({
        ...createDefaultWeeklyHours(),
        mon: [],
      }),
    ).toBe("custom");
  });

  it("presets only write per-day WeeklyHours data without mutating input", () => {
    const initial: WeeklyHours = {
      mon: [],
      tue: [{ open: "11:30", close: "14:30" }],
      wed: [{ open: "11:30", close: "14:30" }],
      thu: [{ open: "11:30", close: "14:30" }],
      fri: [{ open: "11:30", close: "22:00" }],
      sat: [{ open: "12:00", close: "16:00" }],
      sun: [],
    };
    const snapshot = structuredClone(initial);
    const spy = vi.fn();

    render(<ControlledEditor initial={initial} onChangeSpy={spy} />);

    // Initial schedule is custom (7 individual day groups)
    expect(screen.getByTestId("preset-custom").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("hours-group-mon")).toBeDefined();
    expect(screen.getByTestId("hours-group-sun")).toBeDefined();

    // Switch to Weekdays + weekend -> writes per-day data
    fireEvent.click(screen.getByTestId("preset-weekdays-weekend"));
    expect(screen.getByTestId("hours-group-weekdays")).toBeDefined();
    expect(screen.getByTestId("hours-group-weekend")).toBeDefined();
    const afterWeekdaysWeekend = spy.mock.lastCall?.[0] as WeeklyHours;
    expect(afterWeekdaysWeekend.mon).toEqual([{ open: "11:30", close: "14:30" }]);
    expect(afterWeekdaysWeekend.fri).toEqual([{ open: "11:30", close: "14:30" }]);
    expect(afterWeekdaysWeekend.sat).toEqual([{ open: "12:00", close: "16:00" }]);
    expect(afterWeekdaysWeekend.sun).toEqual([{ open: "12:00", close: "16:00" }]);

    // Switch to Every day -> copies template to all 7 days
    fireEvent.click(screen.getByTestId("preset-every-day"));
    expect(screen.getByTestId("hours-group-every_day")).toBeDefined();
    const afterEveryDay = spy.mock.lastCall?.[0] as WeeklyHours;
    for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) {
      expect(afterEveryDay[day]).toEqual([{ open: "11:30", close: "14:30" }]);
    }

    // Input was never mutated
    expect(initial).toEqual(snapshot);
  });

  it("supports adding up to 4 ranges and removing ranges", () => {
    const spy = vi.fn();
    render(<ControlledEditor initial={createDefaultWeeklyHours()} onChangeSpy={spy} />);

    // Starts with 1 range in every_day mode
    expect(screen.getByTestId("time-open-every_day-0")).toBeDefined();
    expect(screen.getByTestId("add-range-every_day")).toBeDefined();

    // Add 3 more ranges -> total 4 (MAX_RANGES_PER_DAY)
    fireEvent.click(screen.getByTestId("add-range-every_day"));
    fireEvent.click(screen.getByTestId("add-range-every_day"));
    fireEvent.click(screen.getByTestId("add-range-every_day"));

    expect(screen.getByTestId("time-open-every_day-3")).toBeDefined();
    expect(screen.queryByTestId("add-range-every_day")).toBeNull();
    expect((spy.mock.lastCall?.[0] as WeeklyHours).mon).toHaveLength(4);

    // Remove range 2 -> back to 3 and Add button reappears
    fireEvent.click(screen.getByTestId("remove-range-every_day-1"));
    expect((spy.mock.lastCall?.[0] as WeeklyHours).mon).toHaveLength(3);
    expect(screen.getByTestId("add-range-every_day")).toBeDefined();
  });

  it("toggles a day/group closed and restores previous ranges when re-opened", () => {
    const initial: WeeklyHours = {
      ...createDefaultWeeklyHours(),
      mon: [{ open: "11:30", close: "15:00" }],
      sun: [],
    };
    const spy = vi.fn();
    render(<ControlledEditor initial={initial} onChangeSpy={spy} />);

    // Toggle Monday closed
    expect(screen.getByTestId("status-mon").textContent).toBe("Open");
    fireEvent.click(screen.getByTestId("toggle-mon"));
    expect(screen.getByTestId("status-mon").textContent).toBe("Closed");
    expect((spy.mock.lastCall?.[0] as WeeklyHours).mon).toEqual([]);
    expect(screen.queryByTestId("time-open-mon-0")).toBeNull();

    // Toggle Monday back open -> restores 11:30–15:00
    fireEvent.click(screen.getByTestId("toggle-mon"));
    expect(screen.getByTestId("status-mon").textContent).toBe("Open");
    expect((spy.mock.lastCall?.[0] as WeeklyHours).mon).toEqual([
      { open: "11:30", close: "15:00" },
    ]);

    // Toggle initially closed Sunday open -> starts with 09:00–18:00
    expect(screen.getByTestId("status-sun").textContent).toBe("Closed");
    fireEvent.click(screen.getByTestId("toggle-sun"));
    expect((spy.mock.lastCall?.[0] as WeeklyHours).sun).toEqual([
      { open: "09:00", close: "18:00" },
    ]);
  });

  it("shows inline validation errors from weeklyHoursSchema for close <= open, overlap, and order", () => {
    const initial: WeeklyHours = {
      mon: [
        { open: "11:30", close: "14:30" },
        { open: "18:00", close: "22:00" },
      ],
      tue: [{ open: "09:00", close: "18:00" }],
      wed: [{ open: "09:00", close: "18:00" }],
      thu: [{ open: "09:00", close: "18:00" }],
      fri: [{ open: "09:00", close: "18:00" }],
      sat: [{ open: "09:00", close: "18:00" }],
      sun: [],
    };
    render(<ControlledEditor initial={initial} />);

    // 1. Make second range overlap first range (14:00 <= 14:30)
    const openSecond = screen.getByTestId("time-open-mon-1") as HTMLSelectElement;
    fireEvent.change(openSecond, { target: { value: "14:00" } });
    expect(openSecond.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByTestId("range-error-mon-1").textContent).toContain(
      enDictionary.settings.openingHours.errorRangeOverlap,
    );

    // 2. Make second range out of order (08:00 < 14:30)
    fireEvent.change(openSecond, { target: { value: "08:00" } });
    expect(screen.getByTestId("range-error-mon-1").textContent).toContain(
      enDictionary.settings.openingHours.errorRangeOverlap,
    );

    // Fix range 2 back to 18:00 -> error disappears
    fireEvent.change(openSecond, { target: { value: "18:00" } });
    expect(screen.queryByTestId("range-error-mon-1")).toBeNull();

    // 3. Make Tuesday close before open (09:00 -> 08:00)
    const closeTue = screen.getByTestId("time-close-tue-0") as HTMLSelectElement;
    fireEvent.change(closeTue, { target: { value: "08:00" } });
    expect(closeTue.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByTestId("range-error-tue-0").textContent).toContain(
      enDictionary.settings.openingHours.errorCloseAfterOpen,
    );
  });

  it("supports 24:00 close time for overnight shifts and renders French labels", () => {
    const spy = vi.fn();
    render(<ControlledEditor initial={createDefaultWeeklyHours()} locale="fr" onChangeSpy={spy} />);

    expect(screen.getByTestId("preset-every-day").textContent).toBe(
      frDictionary.settings.openingHours.presetEveryDay,
    );

    const closeSelect = screen.getByTestId("time-close-every_day-0") as HTMLSelectElement;
    fireEvent.change(closeSelect, { target: { value: "24:00" } });
    expect((spy.mock.lastCall?.[0] as WeeklyHours).fri).toEqual([
      { open: "09:00", close: "24:00" },
    ]);
    expect(screen.queryByTestId("range-error-every_day-0")).toBeNull();
  });
});
