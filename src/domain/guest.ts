import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";

// Canonical E.164 phone regex: '+' followed by 7 to 15 digits (ITU-T recommendation)
export const e164PhoneSchema = z.string().regex(/^\+[1-9]\d{6,14}$/, "Invalid E.164 phone number");

export const guestSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  name: z.string().trim().min(1),
  phone: e164PhoneSchema.optional().nullable(),
  email: z.string().email().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  createdAt: isoDateTimeSchema,
});

export type Guest = z.infer<typeof guestSchema>;

export interface RegionPhoneConfig {
  countryCode: string;
  nationalDigitsLength?: number | readonly number[];
  stripLeadingZero?: boolean;
}

export const DEFAULT_PHONE_REGION = "FR";

// Supported regions configuration for local-to-E.164 parsing.
// ponytail: regex-based E.164 normalisation with FR default; upgrade to libphonenumber-js (min metadata) if multi-national formatting edge cases grow.
export const SUPPORTED_REGIONS: Record<string, RegionPhoneConfig> = {
  FR: { countryCode: "33", nationalDigitsLength: 9, stripLeadingZero: true },
  US: { countryCode: "1", nationalDigitsLength: 10, stripLeadingZero: false },
  CA: { countryCode: "1", nationalDigitsLength: 10, stripLeadingZero: false },
  GB: { countryCode: "44", nationalDigitsLength: 10, stripLeadingZero: true },
  BE: { countryCode: "32", nationalDigitsLength: [8, 9], stripLeadingZero: true },
  CH: { countryCode: "41", nationalDigitsLength: 9, stripLeadingZero: true },
  DE: { countryCode: "49", stripLeadingZero: true },
  ES: { countryCode: "34", nationalDigitsLength: 9, stripLeadingZero: false },
  IT: { countryCode: "39", stripLeadingZero: false },
};

/**
 * Normalises raw phone numbers into standard E.164 format.
 * Defaults to French region (FR), configurable per call.
 */
export function normalizePhoneNumber(
  raw: string,
  defaultRegion: string = DEFAULT_PHONE_REGION,
): string {
  if (typeof raw !== "string") {
    throw new Error("Phone number must be a string");
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Phone number cannot be empty");
  }

  // Remove trunk prefix in parentheses e.g. +33 (0)6 ... or 0033(0)6...
  const withoutTrunk = trimmed.replace(/\s*\(\s*0\s*\)\s*/g, "");

  let normalized: string;

  if (withoutTrunk.startsWith("+")) {
    const digits = withoutTrunk.slice(1).replace(/\D/g, "");
    normalized = `+${digits}`;
  } else if (withoutTrunk.startsWith("00")) {
    const digits = withoutTrunk.slice(2).replace(/\D/g, "");
    normalized = `+${digits}`;
  } else {
    const regionKey = defaultRegion.trim().toUpperCase();
    const regionConfig = SUPPORTED_REGIONS[regionKey];
    if (!regionConfig) {
      throw new Error(`Unsupported default region: "${defaultRegion}"`);
    }

    const digits = withoutTrunk.replace(/\D/g, "");
    if (digits.length === 0) {
      throw new Error("Phone number contains no digits");
    }

    let nationalDigits = digits;
    if (regionConfig.stripLeadingZero && nationalDigits.startsWith("0")) {
      nationalDigits = nationalDigits.slice(1);
    }

    normalized = `+${regionConfig.countryCode}${nationalDigits}`;
  }

  // Strip redundant domestic 0 after +33 if present (e.g. +33 06 12 34 56 78 -> +33612345678)
  if (normalized.startsWith("+330") && normalized.length === 13) {
    normalized = `+33${normalized.slice(4)}`;
  }

  // Validate E.164 general format: + followed by 7 to 15 digits, non-zero first digit
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
    throw new Error(`Invalid E.164 phone number: "${raw}"`);
  }

  // Specific check for France (FR): +33 followed by exactly 9 digits (1 to 9 first digit)
  if (normalized.startsWith("+33")) {
    if (!/^\+33[1-9]\d{8}$/.test(normalized)) {
      throw new Error(`Invalid French phone number: "${raw}"`);
    }
  }

  return normalized;
}

/**
 * Validates whether a phone number can be successfully normalised to E.164.
 */
export function isValidPhoneNumber(
  raw: string,
  defaultRegion: string = DEFAULT_PHONE_REGION,
): boolean {
  try {
    normalizePhoneNumber(raw, defaultRegion);
    return true;
  } catch {
    return false;
  }
}

export interface FindOrCreateGuestInput {
  businessId: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  defaultRegion?: string;
}

export interface FindOrCreateGuestResult {
  guestId: string;
  isNew: boolean;
}

export interface GuestLookupStore {
  findByPhone: (businessId: string, normalizedPhone: string) => Guest | undefined | null;
  save: (guest: Guest) => void;
}

export type GuestStoreInput = Guest[] | GuestLookupStore;

export interface FindOrCreateGuestOptions {
  idGenerator?: () => string;
  now?: () => string;
  onCreated?: (newGuest: Guest) => void;
}

/**
 * Finds an existing guest id by businessId and phone number.
 * Returns only the guest id (or null) to avoid exposing stored guest data.
 */
export function findGuestIdByPhone(
  existingGuests: readonly Guest[],
  businessId: string,
  phone: string,
  defaultRegion: string = DEFAULT_PHONE_REGION,
): string | null {
  const normalizedPhone = normalizePhoneNumber(phone, defaultRegion);
  const match = existingGuests.find((guest) => {
    if (guest.businessId !== businessId || !guest.phone) {
      return false;
    }
    try {
      return normalizePhoneNumber(guest.phone, defaultRegion) === normalizedPhone;
    } catch {
      return guest.phone === normalizedPhone;
    }
  });

  return match ? match.id : null;
}

/**
 * Checks whether a phone number is unique for a given businessId.
 * Optionally excludes a guest ID (useful when updating an existing guest).
 */
export function isGuestPhoneUnique(
  existingGuests: readonly Guest[],
  businessId: string,
  phone: string,
  excludeGuestId?: string,
  defaultRegion: string = DEFAULT_PHONE_REGION,
): boolean {
  const normalizedPhone = normalizePhoneNumber(phone, defaultRegion);
  return !existingGuests.some((guest) => {
    if (guest.businessId !== businessId || !guest.phone) {
      return false;
    }
    if (excludeGuestId && guest.id === excludeGuestId) {
      return false;
    }
    try {
      return normalizePhoneNumber(guest.phone, defaultRegion) === normalizedPhone;
    } catch {
      return guest.phone === normalizedPhone;
    }
  });
}

/**
 * Finds an existing guest by normalised phone number or creates a new one.
 * Returns only { guestId, isNew } to prevent exposing stored customer data to the caller.
 */
export function findOrCreateGuest(
  store: GuestStoreInput,
  input: FindOrCreateGuestInput,
  options?: FindOrCreateGuestOptions,
): FindOrCreateGuestResult {
  const businessId = uuidSchema.parse(input.businessId);
  const name = z.string().trim().min(1).parse(input.name);
  const normalizedPhone = normalizePhoneNumber(input.phone, input.defaultRegion);

  let existingGuest: Guest | undefined | null;

  if (Array.isArray(store)) {
    const foundId = findGuestIdByPhone(store, businessId, normalizedPhone, input.defaultRegion);
    if (foundId) {
      existingGuest = store.find((g) => g.id === foundId);
    }
  } else {
    existingGuest = store.findByPhone(businessId, normalizedPhone);
  }

  if (existingGuest) {
    return {
      guestId: existingGuest.id,
      isNew: false,
    };
  }

  const newGuest: Guest = {
    id: options?.idGenerator ? options.idGenerator() : crypto.randomUUID(),
    businessId,
    name,
    phone: normalizedPhone,
    email: input.email ? z.string().email().trim().parse(input.email) : null,
    address: input.address ? input.address.trim() : null,
    notes: input.notes ? input.notes.trim() : null,
    createdAt: options?.now ? options.now() : new Date().toISOString(),
  };

  guestSchema.parse(newGuest);

  if (Array.isArray(store)) {
    store.push(newGuest);
  } else {
    store.save(newGuest);
  }

  if (options?.onCreated) {
    options.onCreated(newGuest);
  }

  return {
    guestId: newGuest.id,
    isNew: true,
  };
}
