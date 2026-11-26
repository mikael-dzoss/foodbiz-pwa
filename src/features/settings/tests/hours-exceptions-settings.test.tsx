import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HoursExceptionsSettings } from "../components/hours-exceptions-settings";
import { ToastProvider } from "@/components/ui";
import type { HoursException } from "@/domain/opening-hours";
import { updateHoursExceptionsAction } from "../actions";

vi.mock("../actions", () => ({ updateHoursExceptionsAction: vi.fn() }));

const saveMock = vi.mocked(updateHoursExceptionsAction);
const NOW = new Date("2026-12-01T10:00:00Z");

const christmas: HoursException = {
  from: "2026-12-24",
  to: "2026-12-26",
  ranges: [],
  note: "Xmas",
};
const newYear: HoursException = {
  from: "2026-12-31",
  to: "2026-12-31",
  ranges: [{ open: "10:00", close: "16:00" }],
};
const past: HoursException = { from: "2026-05-01", to: "2026-05-01", ranges: [] };

function renderPage(initial: HoursException[] = [christmas, newYear, past]) {
  return render(
    <ToastProvider>
      <HoursExceptionsSettings initial={initial} locale="en" timeZone="Europe/Paris" now={NOW} />
    </ToastProvider>,
  );
}

function lastSaved(): HoursException[] {
  const call = saveMock.mock.lastCall?.[0] as { hoursExceptions: HoursException[] };
  return call.hoursExceptions;
}

function fillDates(from: string, to?: string) {
  fireEvent.change(screen.getByTestId("exception-from"), { target: { value: from } });
  if (to) fireEvent.change(screen.getByTestId("exception-to"), { target: { value: to } });
}

describe("HoursExceptionsSettings (#375)", () => {
  beforeEach(() => {
    saveMock.mockReset();
    saveMock.mockImplementation(async (input?: unknown) => ({
      ok: true as const,
      data: input as never,
    }));
  });

  it("lists upcoming exceptions with hours/closed and note, and collapses past ones", () => {
    renderPage();
    const upcoming = screen.getByTestId("exceptions-upcoming");
    const xmas = within(upcoming).getByTestId("exception-row-2026-12-24");
    expect(xmas.textContent).toContain("Closed");
    expect(xmas.textContent).toContain("Xmas");
    expect(within(upcoming).getByTestId("exception-row-2026-12-31").textContent).toContain(
      "10:00–16:00",
    );
    expect(screen.queryByTestId("exception-row-2026-05-01")).toBeNull();
    fireEvent.click(screen.getByTestId("exceptions-past-toggle"));
    expect(screen.getByTestId("exception-row-2026-05-01")).toBeDefined();
  });

  it("shows an empty state", () => {
    renderPage([]);
    expect(screen.getByTestId("exceptions-empty")).toBeDefined();
  });

  it("adds a holiday range as closed", async () => {
    renderPage([]);
    fireEvent.click(screen.getByTestId("exception-add"));
    fillDates("2027-08-10", "2027-08-20");
    fireEvent.change(screen.getByTestId("exception-note"), { target: { value: "Summer" } });
    fireEvent.click(screen.getByTestId("exception-save"));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(lastSaved()).toEqual([
      { from: "2027-08-10", to: "2027-08-20", ranges: [], note: "Summer" },
    ]);
    await waitFor(() => expect(screen.getByTestId("exception-row-2027-08-10")).toBeDefined());
    expect(screen.queryByTestId("exception-sheet")).toBeNull();
  });

  it("adds special hours on a single day", async () => {
    renderPage([]);
    fireEvent.click(screen.getByTestId("exception-add"));
    fillDates("2026-12-06");
    expect((screen.getByTestId("exception-to") as HTMLInputElement).value).toBe("2026-12-06");
    fireEvent.click(screen.getByTestId("exception-mode-custom"));
    fireEvent.change(screen.getByTestId("time-open-exception-0"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByTestId("time-close-exception-0"), { target: { value: "13:00" } });
    fireEvent.click(screen.getByTestId("exception-save"));
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(lastSaved()).toEqual([
      { from: "2026-12-06", to: "2026-12-06", ranges: [{ open: "10:00", close: "13:00" }] },
    ]);
  });

  it("edits an existing exception", async () => {
    renderPage();
    fireEvent.click(screen.getByTestId("exception-row-2026-12-31"));
    expect((screen.getByTestId("time-close-exception-0") as HTMLSelectElement).value).toBe("16:00");
    fireEvent.change(screen.getByTestId("time-close-exception-0"), { target: { value: "18:00" } });
    fireEvent.click(screen.getByTestId("exception-save"));
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    const saved = lastSaved();
    expect(saved).toHaveLength(3);
    expect(saved.find((ex) => ex.from === "2026-12-31")?.ranges).toEqual([
      { open: "10:00", close: "18:00" },
    ]);
  });

  it("deletes after confirmation", async () => {
    renderPage();
    fireEvent.click(screen.getByTestId("exception-row-2026-12-24"));
    fireEvent.click(screen.getByTestId("exception-delete"));
    fireEvent.click(screen.getByTestId("exception-delete-dialog-cancel"));
    expect(saveMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("exception-delete"));
    fireEvent.click(screen.getByTestId("exception-delete-dialog-confirm"));
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(lastSaved().map((ex) => ex.from)).toEqual(["2026-05-01", "2026-12-31"]);
    await waitFor(() => expect(screen.queryByTestId("exception-row-2026-12-24")).toBeNull());
  });

  it("shows inline validation: overlap, end before start, span, note length", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("exception-add"));

    fillDates("2026-12-25", "2026-12-25");
    fireEvent.click(screen.getByTestId("exception-save"));
    expect(screen.getByTestId("exception-form").textContent).toContain(
      "These dates overlap another exceptional day",
    );

    fillDates("2027-03-10", "2027-03-05");
    expect(screen.getByTestId("exception-form").textContent).toContain(
      "End date must be on or after the start date",
    );

    fillDates("2027-03-01", "2027-06-30");
    expect(screen.getByTestId("exception-form").textContent).toContain("at most 60 days");

    fireEvent.change(screen.getByTestId("exception-note"), { target: { value: "x".repeat(51) } });
    expect(screen.getByTestId("exception-form").textContent).toContain(
      "Note must be 50 characters or less",
    );
    expect(screen.getByTestId("exception-note-counter").textContent).toBe("51/50");
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("requires a date", () => {
    renderPage([]);
    fireEvent.click(screen.getByTestId("exception-add"));
    fireEvent.change(screen.getByTestId("exception-from"), { target: { value: "" } });
    fireEvent.change(screen.getByTestId("exception-to"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("exception-save"));
    expect(screen.getByTestId("exception-form").textContent).toContain("Pick a date");
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("shows a localized error when the action fails", async () => {
    saveMock.mockResolvedValue({ ok: false, code: "INTERNAL", message: "db down" });
    renderPage([]);
    fireEvent.click(screen.getByTestId("exception-add"));
    fillDates("2026-12-06");
    fireEvent.click(screen.getByTestId("exception-save"));
    await waitFor(() => expect(screen.getByTestId("exception-form-error")).toBeDefined());
    expect(screen.queryByTestId("exception-row-2026-12-06")).toBeNull();
  });
});
