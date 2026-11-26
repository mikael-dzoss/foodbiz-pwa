import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegularHoursForm } from "../components/opening-hours/regular-hours-form";
import { ToastProvider } from "@/components/ui";
import type { WeeklyHours } from "@/domain/opening-hours";
import { enDictionary } from "@/domain/i18n";

const validHours: WeeklyHours = {
  mon: [],
  tue: [{ open: "11:30", close: "14:30" }],
  wed: [{ open: "11:30", close: "14:30" }],
  thu: [{ open: "11:30", close: "14:30" }],
  fri: [{ open: "18:00", close: "24:00" }],
  sat: [{ open: "00:00", close: "01:00" }],
  sun: [],
};

describe("RegularHoursForm (#372)", () => {
  it("submits valid weekly hours via onSave and displays a success toast", async () => {
    const onSave = vi.fn(async () => ({ ok: true as const, data: validHours }));

    render(
      <ToastProvider>
        <RegularHoursForm initial={validHours} onSave={onSave} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByTestId("save-regular-hours-button"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(validHours);
    });
    expect(screen.getByText(enDictionary.settings.openingHours.saveSuccess)).toBeDefined();
  });

  it("blocks submit when ranges are invalid and does not call onSave", async () => {
    const onSave = vi.fn(async () => ({ ok: true as const, data: validHours }));

    render(
      <ToastProvider>
        <RegularHoursForm initial={validHours} onSave={onSave} />
      </ToastProvider>,
    );

    // Make Tuesday close before open
    fireEvent.change(screen.getByTestId("time-close-tue-0"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByTestId("save-regular-hours-button"));

    await waitFor(() => {
      expect(screen.getByTestId("regular-hours-form-error").textContent).toContain(
        enDictionary.settings.openingHours.errorFixBeforeSave,
      );
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows localized error feedback when onSave fails", async () => {
    const onSave = vi.fn(async () => ({
      ok: false as const,
      code: "INTERNAL" as const,
      message: "db down",
    }));

    render(
      <ToastProvider>
        <RegularHoursForm initial={validHours} onSave={onSave} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByTestId("save-regular-hours-button"));

    await waitFor(() => {
      expect(screen.getByTestId("regular-hours-form-error").textContent).toBe(
        enDictionary.common.actionErrors.INTERNAL,
      );
    });
  });

  it("discards unsaved edits back to the saved schedule", () => {
    const onSave = vi.fn(async () => ({ ok: true as const, data: validHours }));

    render(
      <ToastProvider>
        <RegularHoursForm initial={validHours} onSave={onSave} />
      </ToastProvider>,
    );

    const openTue = screen.getByTestId("time-open-tue-0") as HTMLSelectElement;
    expect(openTue.value).toBe("11:30");

    fireEvent.change(openTue, { target: { value: "09:00" } });
    expect(openTue.value).toBe("09:00");

    fireEvent.click(screen.getByTestId("discard-button"));
    expect((screen.getByTestId("time-open-tue-0") as HTMLSelectElement).value).toBe("11:30");
  });

  it("confirms and executes Clear structured hours via ConfirmDialog", async () => {
    const onSave = vi.fn(async () => ({ ok: true as const, data: validHours }));
    const onClear = vi.fn(async () => ({ ok: true as const, data: null }));

    render(
      <ToastProvider>
        <RegularHoursForm initial={validHours} onSave={onSave} onClear={onClear} />
      </ToastProvider>,
    );

    // Open confirm dialog, cancel first -> onClear not called
    fireEvent.click(screen.getByTestId("clear-structured-hours-button"));
    expect(screen.getByTestId("clear-hours-confirm-dialog")).toBeDefined();
    fireEvent.click(screen.getByTestId("clear-hours-confirm-dialog-cancel"));
    expect(onClear).not.toHaveBeenCalled();

    // Re-open and confirm -> onClear called, button hidden afterward
    fireEvent.click(screen.getByTestId("clear-structured-hours-button"));
    fireEvent.click(screen.getByTestId("clear-hours-confirm-dialog-confirm"));

    await waitFor(() => {
      expect(onClear).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByTestId("clear-structured-hours-button")).toBeNull();
    });
    expect(screen.getByText(enDictionary.settings.openingHours.clearSuccess)).toBeDefined();
  });

  it("omits clear button when onClear is absent or initial is null, and displays footerNote", () => {
    const onSave = vi.fn(async () => ({ ok: true as const, data: validHours }));

    const { unmount } = render(
      <RegularHoursForm
        initial={validHours}
        onSave={onSave}
        footerNote="Shop closures and holidays apply to all pickup points"
      />,
    );

    expect(screen.queryByTestId("clear-structured-hours-button")).toBeNull();
    expect(screen.getByTestId("regular-hours-footer-note").textContent).toBe(
      "Shop closures and holidays apply to all pickup points",
    );

    unmount();
    render(
      <RegularHoursForm
        initial={null}
        onSave={onSave}
        onClear={vi.fn(async () => ({ ok: true as const, data: null }))}
      />,
    );
    expect(screen.queryByTestId("clear-structured-hours-button")).toBeNull();
  });
});
