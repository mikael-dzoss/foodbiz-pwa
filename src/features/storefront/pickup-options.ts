import { formatMoney } from "@/domain/formatting/money";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { groupWeeklyHours, type OpeningSchedule, type WeeklyHours } from "@/domain/opening-hours";
import { pickupScheduleFor, type StorefrontPickupLocation } from "@/domain/pickup-location";

/** Sentinel persisted in client storage when the customer explicitly chose pickup at the shop. */
export const SHOP_PICKUP_VALUE = "shop" as const;

/** Show the first N options before collapsing behind "Show all". */
export const PICKUP_COLLAPSED_LIMIT = 3;

export interface PickupOptionItem {
  readonly id: string;
  readonly kind: "shop" | "relay";
  readonly name: string;
  readonly description: string | null;
  readonly addressLine: string | null;
  readonly feeCents: number;
  readonly hoursText: string | null;
  readonly relay: StorefrontPickupLocation | null;
}

export interface ResolvedPickupState {
  readonly optionCount: number;
  readonly unavailable: boolean;
  readonly isSingleOption: boolean;
  readonly requiresChoice: boolean;
  readonly selectedChoice: string | null;
  readonly selectedRelay: StorefrontPickupLocation | null;
  readonly hasPaidOption: boolean;
}

/** True when `choice` is unset (`null`) or still offered by the current catalog. */
export function isPickupChoiceValid(
  choice: string | null,
  shopPickupEnabled: boolean,
  pickupLocations: readonly StorefrontPickupLocation[],
): boolean {
  if (choice === null) return true;
  if (choice === SHOP_PICKUP_VALUE) return shopPickupEnabled;
  return pickupLocations.some((location) => location.id === choice);
}

/**
 * Resolves the effective storefront pickup selection against the current catalog:
 * - 0 options: pickup is unavailable.
 * - 1 option: preselected automatically (the shop or the sole relay).
 * - 2+ options: keeps a still-valid stored choice, otherwise requires the customer to pick.
 */
export function resolvePickupState(
  storedChoice: string | null,
  shopPickupEnabled: boolean,
  pickupLocations: readonly StorefrontPickupLocation[],
): ResolvedPickupState {
  const optionCount = (shopPickupEnabled ? 1 : 0) + pickupLocations.length;
  const hasPaidOption = pickupLocations.some((location) => location.feeCents > 0);

  if (optionCount === 0) {
    return {
      optionCount: 0,
      unavailable: true,
      isSingleOption: false,
      requiresChoice: false,
      selectedChoice: null,
      selectedRelay: null,
      hasPaidOption: false,
    };
  }

  if (optionCount === 1) {
    if (shopPickupEnabled) {
      return {
        optionCount: 1,
        unavailable: false,
        isSingleOption: true,
        requiresChoice: false,
        selectedChoice: SHOP_PICKUP_VALUE,
        selectedRelay: null,
        hasPaidOption: false,
      };
    }
    const soleRelay = pickupLocations[0];
    return {
      optionCount: 1,
      unavailable: false,
      isSingleOption: true,
      requiresChoice: false,
      selectedChoice: soleRelay.id,
      selectedRelay: soleRelay,
      hasPaidOption,
    };
  }

  if (storedChoice === SHOP_PICKUP_VALUE && shopPickupEnabled) {
    return {
      optionCount,
      unavailable: false,
      isSingleOption: false,
      requiresChoice: false,
      selectedChoice: SHOP_PICKUP_VALUE,
      selectedRelay: null,
      hasPaidOption,
    };
  }

  const matchedRelay =
    storedChoice !== null && storedChoice !== SHOP_PICKUP_VALUE
      ? (pickupLocations.find((location) => location.id === storedChoice) ?? null)
      : null;

  if (matchedRelay) {
    return {
      optionCount,
      unavailable: false,
      isSingleOption: false,
      requiresChoice: false,
      selectedChoice: matchedRelay.id,
      selectedRelay: matchedRelay,
      hasPaidOption,
    };
  }

  return {
    optionCount,
    unavailable: false,
    isSingleOption: false,
    requiresChoice: true,
    selectedChoice: null,
    selectedRelay: null,
    hasPaidOption,
  };
}

function capitalizeLabel(label: string, locale: SupportedLocale): string {
  if (!label) return label;
  return label[0].toLocaleUpperCase(locale) + label.slice(1);
}

/** Compact one-line summary of weekly hours (e.g. "Tue–Fri 11:30–14:30 · Sat 10:00–12:00"). */
export function formatCompactWeeklyHours(
  weekly: WeeklyHours,
  locale: SupportedLocale,
  closedLabel: string,
): string {
  const openGroups = groupWeeklyHours(weekly, locale).filter(
    (group) => !group.closed && group.ranges.length > 0,
  );
  if (openGroups.length === 0) return closedLabel;
  return openGroups
    .map((group) => `${capitalizeLabel(group.label, locale)} ${group.ranges.join(", ")}`)
    .join(" · ");
}

/** "Free" / "Gratuit" when 0, or "+€1.50" / "+1,50 €" when positive. */
export function formatPickupFee(
  feeCents: number,
  locale: SupportedLocale,
  freeLabel: string,
): string {
  if (feeCents <= 0) return freeLabel;
  return `+${formatMoney(feeCents, locale)}`;
}

export interface BuildPickupOptionItemsInput {
  readonly shopPickupEnabled: boolean;
  readonly pickupLocations: readonly StorefrontPickupLocation[];
  readonly businessName?: string | null;
  readonly businessAddress?: string | null;
  readonly businessSchedule: OpeningSchedule;
  readonly openingHoursText?: string | null;
  readonly locale: SupportedLocale;
  readonly dict: StorefrontDictionary;
}

/** Builds the display rows for the storefront pickup picker (shop row first when enabled). */
export function buildPickupOptionItems({
  shopPickupEnabled,
  pickupLocations,
  businessName,
  businessAddress,
  businessSchedule,
  openingHoursText,
  locale,
  dict,
}: BuildPickupOptionItemsInput): PickupOptionItem[] {
  const items: PickupOptionItem[] = [];

  if (shopPickupEnabled) {
    const trimmedHours = openingHoursText?.trim() || null;
    const shopHoursText = businessSchedule.weekly
      ? formatCompactWeeklyHours(businessSchedule.weekly, locale, dict.storeClosedBadge)
      : trimmedHours;

    items.push({
      id: SHOP_PICKUP_VALUE,
      kind: "shop",
      name: businessName?.trim() || dict.pickupLocationShopFallback,
      description: null,
      addressLine: businessAddress?.trim() || null,
      feeCents: 0,
      hoursText: shopHoursText,
      relay: null,
    });
  }

  for (const location of pickupLocations) {
    let hoursText: string;
    if (location.weeklyHours === null) {
      hoursText = dict.pickupLocationSameAsShopHours;
    } else {
      const effectiveWeekly = pickupScheduleFor(businessSchedule, location.weeklyHours).weekly;
      hoursText = effectiveWeekly
        ? formatCompactWeeklyHours(effectiveWeekly, locale, dict.storeClosedBadge)
        : dict.pickupLocationSameAsShopHours;
    }

    items.push({
      id: location.id,
      kind: "relay",
      name: location.name,
      description: location.description?.trim() || null,
      addressLine: `${location.address}, ${location.postcode}`,
      feeCents: location.feeCents,
      hoursText,
      relay: location,
    });
  }

  return items;
}
