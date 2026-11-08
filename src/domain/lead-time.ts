import { z } from "zod";

export const leadTimeUnitSchema = z.enum(["minutes", "hours", "business_days"]);
export type LeadTimeUnit = z.infer<typeof leadTimeUnitSchema>;

export const leadTimeValueSchema = z
  .number()
  .int("Lead time must be a whole number")
  .min(1, "Lead time must be at least 1")
  .max(999, "Lead time must be 999 or less");

export interface LeadTime {
  readonly value: number;
  readonly unit: LeadTimeUnit;
}

export const DEFAULT_LEAD_TIME: LeadTime = { value: 1, unit: "business_days" };

const UNIT_LABELS: Record<"en" | "fr", Record<LeadTimeUnit, readonly [string, string]>> = {
  en: {
    minutes: ["min", "min"],
    hours: ["hour", "hours"],
    business_days: ["business day", "business days"],
  },
  fr: {
    minutes: ["min", "min"],
    hours: ["heure", "heures"],
    business_days: ["jour ouvré", "jours ouvrés"],
  },
};

/** Approximate, display-only lead time such as "~1 business day" or "~20 min". */
export function formatLeadTime(leadTime: LeadTime, locale: "en" | "fr"): string {
  const [singular, plural] = UNIT_LABELS[locale][leadTime.unit];
  return `~${leadTime.value} ${leadTime.value === 1 ? singular : plural}`;
}

export function getLeadTime(
  settings: { leadTimeValue?: number; leadTimeUnit?: LeadTimeUnit } | null | undefined,
): LeadTime {
  return {
    value: settings?.leadTimeValue ?? DEFAULT_LEAD_TIME.value,
    unit: settings?.leadTimeUnit ?? DEFAULT_LEAD_TIME.unit,
  };
}
