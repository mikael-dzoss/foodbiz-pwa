"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { LEGAL_PAGES_AVAILABLE } from "@/config/app";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/icons";
import type { StorefrontBusiness } from "@/domain/storefront-business";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";

/** Anchors on the shop info page (#233), in page order. */
export const SHOP_INFO_SECTIONS = [
  ["overview", "footerShopInformation"],
  ["contact", "footerContactUs"],
  ["hours", "footerOpeningHours"],
  ["location", "footerLocation"],
  ["ordering-policy", "footerOrderingPolicy"],
] as const satisfies ReadonlyArray<readonly [string, keyof StorefrontDictionary]>;

export interface StorefrontFooterProps {
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  business?: StorefrontBusiness;
  businessName?: string;
  currentYear?: number;
  legalPagesAvailable?: boolean;
}

export function StorefrontFooter({
  locale,
  dict,
  business,
  businessName = "La Petite Boulangerie",
  currentYear = new Date().getFullYear(),
  legalPagesAvailable = LEGAL_PAGES_AVAILABLE,
}: StorefrontFooterProps) {
  const pathname = usePathname();

  // Hide footer on Info page and Product detail view (anchored bottom action bars present)
  if (pathname && (pathname.includes("/info") || pathname.includes("/p/"))) {
    return null;
  }

  const displayName = business?.name?.trim() || businessName;
  const description = business?.description?.trim() || "";
  const logoSrc = business?.logoUrl?.trim() || "/icons/icon.svg";

  const instagramUrl = business?.instagramUrl?.trim() || "";
  const facebookUrl = business?.facebookUrl?.trim() || "";
  const tiktokUrl = business?.tiktokUrl?.trim() || "";
  const hasSocials = Boolean(instagramUrl || facebookUrl || tiktokUrl);

  return (
    <footer data-testid="storefront-footer" className="border-border bg-card mt-auto border-t py-5">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Row 1: Brand identity, contact lines, and Shop info link */}
        <div data-testid="footer-row-1" className="space-y-3">
          <div className="flex items-center gap-3">
            <Image
              src={logoSrc}
              alt={displayName}
              width={44}
              height={44}
              unoptimized={!logoSrc.startsWith("/") || logoSrc.endsWith(".svg")}
              data-testid="footer-business-logo"
              className="border-border bg-muted h-11 w-11 shrink-0 rounded-full border object-cover"
            />
            <div className="min-w-0">
              <p
                data-testid="footer-business-name"
                className="text-foreground text-base font-bold tracking-tight"
              >
                {displayName}
              </p>
              {description && (
                <p
                  data-testid="footer-business-description"
                  className="text-muted-foreground mt-0.5 text-xs leading-snug"
                >
                  {description}
                </p>
              )}
            </div>
          </div>

          <nav aria-label={dict.shopInfo}>
            <ul
              data-testid="footer-section-links"
              className="border-border divide-border divide-y overflow-hidden rounded-xl border"
            >
              {SHOP_INFO_SECTIONS.map(([anchor, labelKey]) => (
                <li key={anchor}>
                  <Link
                    href={`/${locale}/info#${anchor}`}
                    data-testid={`footer-link-${anchor}`}
                    className="text-foreground hover:bg-muted focus-visible:ring-ring flex min-h-11 items-center justify-between px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
                  >
                    <span>{dict[labelKey]}</span>
                    <ChevronRight
                      className="text-muted-foreground h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Thin divider */}
        <hr className="border-border my-3 border-t" />

        {/* Row 2: Social links, conditional legal links, and dynamic copyright */}
        <div
          data-testid="footer-row-2"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        >
          {hasSocials && (
            <div
              data-testid="footer-social-links"
              className="flex items-center justify-start gap-2"
            >
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={dict.socialOnInstagram.replace("{business}", displayName)}
                  data-testid="footer-social-instagram"
                  className="border-border bg-muted/40 text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                >
                  <InstagramIcon className="h-4 w-4" />
                </a>
              )}
              {facebookUrl && (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={dict.socialOnFacebook.replace("{business}", displayName)}
                  data-testid="footer-social-facebook"
                  className="border-border bg-muted/40 text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                >
                  <FacebookIcon className="h-4 w-4" />
                </a>
              )}
              {tiktokUrl && (
                <a
                  href={tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={dict.socialOnTikTok.replace("{business}", displayName)}
                  data-testid="footer-social-tiktok"
                  className="border-border bg-muted/40 text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                >
                  <TikTokIcon className="h-4 w-4" />
                </a>
              )}
            </div>
          )}

          {legalPagesAvailable && (
            <div
              data-testid="footer-legal-links"
              className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs"
            >
              <Link
                href={`/${locale}/legal/privacy`}
                className="hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
              >
                {dict.privacy}
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href={`/${locale}/legal/terms`}
                className="hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
              >
                {dict.terms}
              </Link>
            </div>
          )}

          <div
            data-testid="footer-copyright"
            className="text-muted-foreground text-xs tabular-nums"
          >
            © {currentYear} {displayName}
          </div>
        </div>
      </div>
    </footer>
  );
}
