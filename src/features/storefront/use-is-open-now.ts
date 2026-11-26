"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  isOpenAt,
  nextOpening,
  rangesForDate,
  type OpeningSchedule,
  type OpeningSlot,
} from "@/domain/opening-hours";
import { getZonedDay, getZonedMinutesOfDay } from "@/domain/timezone";

const TICK_MS = 60_000;

export interface OpenNowStatus {
  isOpen: boolean;
  /** Close time of the range containing now (`"HH:MM"`), when open and known. */
  closesAt: string | null;
  /** Next opening slot while closed; `null` when open or when none is scheduled. */
  next: OpeningSlot | null;
  /** Today's calendar day on the business clock (to tell "today" from a later day). */
  today: string;
}

function subscribeMinuteTick(onChange: () => void): () => void {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Encodes the status as a string so `useSyncExternalStore` snapshots compare by value. */
function encodeStatus(schedule: OpeningSchedule, tz: string, now: Date): string {
  const today = getZonedDay(now, tz);
  const isOpen = isOpenAt(schedule, tz, now);
  if (isOpen) {
    const resolved = rangesForDate(schedule, today);
    const minutes = getZonedMinutesOfDay(now, tz);
    const range = resolved?.ranges.find(
      (r) => toMinutes(r.open) <= minutes && minutes < toMinutes(r.close),
    );
    return `1|${range?.close ?? ""}||${today}`;
  }
  const next = nextOpening(schedule, tz, now);
  return `0||${next ? `${next.date}T${next.time}` : ""}|${today}`;
}

/**
 * Open/closed state of `schedule` on the business clock, ticking every minute. Returns `null` on
 * the server and during hydration so callers render a neutral state (the clock is only read on
 * the client; never from a cached server value).
 */
export function useOpenNowStatus(schedule: OpeningSchedule, tz: string): OpenNowStatus | null {
  const getSnapshot = useCallback(() => encodeStatus(schedule, tz, new Date()), [schedule, tz]);
  const encoded = useSyncExternalStore(subscribeMinuteTick, getSnapshot, () => null);

  return useMemo(() => {
    if (encoded === null) return null;
    const [open, closesAt, nextRaw, today] = encoded.split("|");
    const [date, time] = nextRaw ? nextRaw.split("T") : [];
    return {
      isOpen: open === "1",
      closesAt: closesAt || null,
      next: date && time ? { date, time } : null,
      today,
    };
  }, [encoded]);
}

/** `true` / `false` once on the client, `null` while rendering on the server. */
export function useIsOpenNow(schedule: OpeningSchedule, tz: string): boolean | null {
  return useOpenNowStatus(schedule, tz)?.isOpen ?? null;
}
