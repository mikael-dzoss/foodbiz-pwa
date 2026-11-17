"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_TIMEZONE, getZonedDay } from "@/domain/timezone";

const BusinessTimeZoneContext = createContext<string>(DEFAULT_TIMEZONE);

/**
 * Provides the business operating time zone (#168) to manager components. The server layout reads
 * it from the settings, so server render and hydration format every timestamp in the same zone
 * whatever the server or the device uses.
 */
export function BusinessTimeZoneProvider({
  timeZone,
  children,
}: {
  timeZone: string;
  children: ReactNode;
}) {
  return <BusinessTimeZoneContext value={timeZone}>{children}</BusinessTimeZoneContext>;
}

export function useBusinessTimeZone(): string {
  return useContext(BusinessTimeZoneContext);
}

const subscribeNever = () => () => {};

/**
 * Today's calendar day (YYYY-MM-DD) in `timeZone`, or `null` while rendering on the server and
 * during hydration. The clock is read only on the client after hydration, so the server and the
 * first client render always agree (no mismatch, no prerender current-time error).
 */
export function useZonedToday(timeZone: string): string | null {
  return useSyncExternalStore(
    subscribeNever,
    () => getZonedDay(new Date(), timeZone),
    () => null,
  );
}
