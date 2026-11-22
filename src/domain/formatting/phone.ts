import { normalizePhoneNumber } from "../guest";

/**
 * Formats a phone number for clean user-facing display.
 * Formats French numbers (+33) as "+33 6 12 34 56 78" or national "06 12 34 56 78".
 * For other countries, formats in international chunks.
 */
export function formatPhoneNumber(
  phone: string,
  style: "international" | "national" = "international",
): string {
  if (!phone || typeof phone !== "string") {
    return "";
  }

  let normalized = phone.trim();
  try {
    normalized = normalizePhoneNumber(normalized);
  } catch {
    // If it cannot be parsed to E.164, return original trimmed string
    return normalized;
  }

  // Handle French numbers: +33 followed by 9 digits
  if (normalized.startsWith("+33") && normalized.length === 12) {
    const nationalDigits = normalized.slice(3); // 9 digits, e.g. 612345678
    const grouped = [
      nationalDigits.slice(0, 1),
      nationalDigits.slice(1, 3),
      nationalDigits.slice(3, 5),
      nationalDigits.slice(5, 7),
      nationalDigits.slice(7, 9),
    ].join(" ");

    if (style === "national") {
      return `0${grouped}`;
    }
    return `+33 ${grouped}`;
  }

  // Handle US/CA numbers: +1 followed by 10 digits
  if (normalized.startsWith("+1") && normalized.length === 12) {
    const area = normalized.slice(2, 5);
    const prefix = normalized.slice(5, 8);
    const line = normalized.slice(8, 12);
    if (style === "national") {
      return `(${area}) ${prefix}-${line}`;
    }
    return `+1 (${area}) ${prefix}-${line}`;
  }

  // Handle UK numbers: +44 followed by 10 digits
  if (normalized.startsWith("+44") && normalized.length === 13) {
    const area = normalized.slice(3, 7);
    const rest = normalized.slice(7);
    if (style === "national") {
      return `0${area} ${rest}`;
    }
    return `+44 ${area} ${rest}`;
  }

  // Generic fallback: +countryCode followed by spaced chunks of digits
  return normalized;
}
