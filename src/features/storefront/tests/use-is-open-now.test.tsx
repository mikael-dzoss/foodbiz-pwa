import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsOpenNow, useOpenNowStatus } from "../use-is-open-now";
import type { OpeningSchedule, WeeklyHours } from "@/domain/opening-hours";

const TZ = "Europe/Paris";
const day = [{ open: "11:30", close: "14:30" }];
const weekly: WeeklyHours = {
  mon: [],
  tue: day,
  wed: day,
  thu: day,
  fri: day,
  sat: day,
  sun: [],
};
const schedule: OpeningSchedule = { weekly, exceptions: [] };

describe("useIsOpenNow (#372)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is open inside a range on the business clock", () => {
    // Tue 2026-12-01 12:00 Paris = 11:00Z
    vi.setSystemTime(new Date("2026-12-01T11:00:00Z"));
    const { result } = renderHook(() => useIsOpenNow(schedule, TZ));
    expect(result.current).toBe(true);
  });

  it("is closed outside ranges and exposes the next opening", () => {
    // Mon 2026-11-30 12:00 Paris: closed all day, next opening Tue 11:30
    vi.setSystemTime(new Date("2026-11-30T11:00:00Z"));
    const { result } = renderHook(() => useOpenNowStatus(schedule, TZ));
    expect(result.current).toMatchObject({
      isOpen: false,
      next: { date: "2026-12-01", time: "11:30" },
      today: "2026-11-30",
    });
  });

  it("exposes the closing time while open", () => {
    vi.setSystemTime(new Date("2026-12-01T11:00:00Z"));
    const { result } = renderHook(() => useOpenNowStatus(schedule, TZ));
    expect(result.current?.closesAt).toBe("14:30");
  });

  it("ticks every minute and flips when the shop closes", () => {
    vi.setSystemTime(new Date("2026-12-01T13:29:30Z")); // 14:29:30 Paris
    const { result } = renderHook(() => useIsOpenNow(schedule, TZ));
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(false);
  });
});
