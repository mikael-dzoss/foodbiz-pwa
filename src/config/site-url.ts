/** Absolute site origin for `metadataBase` (canonical/alternate links); undefined when unset or invalid. */
export function getSiteUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SITE_URL) {
  if (!raw?.trim()) return undefined;
  try {
    return new URL(raw.trim());
  } catch {
    return undefined;
  }
}
