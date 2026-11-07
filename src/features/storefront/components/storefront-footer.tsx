"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { LEGAL_PAGES_AVAILABLE } from "@/config/app";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/icons";
import type { Business } from "@/domain/business";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";

export interface StorefrontFooterProps {
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  business?: Business;
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
  const phone = business?.phone?.trim() || "";
  const email = business?.email?.trim() || "";
  const whatsappNumber = business?.whatsappNumber?.trim() || "";
  const whatsappDigits = whatsappNumber.replace(/\D/g, "");
  const address = business?.address?.trim() || "";

  const instagramUrl = business?.instagramUrl?.trim() || "";
  const facebookUrl = business?.facebookUrl?.trim() || "";
  const tiktokUrl = business?.tiktokUrl?.trim() || "";
  const hasSocials = Boolean(instagramUrl || facebookUrl || tiktokUrl);

  return (
    <footer data-testid="storefront-footer" className="border-border bg-card mt-auto border-t py-6">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Row 1: Brand identity, contact lines, and Shop info link */}
        <div data-testid="footer-row-1" className="space-y-4">
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
                className="font-headline text-foreground text-base font-bold tracking-tight"
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

          <div className="border-border space-y-1 border-t pt-3">
            {phone && (
              <a
                href={`tel:${phone}`}
                data-testid="footer-phone-link"
                className="text-foreground hover:text-primary focus-visible:ring-ring group flex min-h-11 items-center justify-between rounded-md px-1 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
              >
                <span className="flex items-center gap-3">
                  <Phone
                    className="text-muted-foreground group-hover:text-primary h-4 w-4 shrink-0 transition-colors"
                    aria-hidden="true"
                  />
                  <span className="font-medium tabular-nums">{phone}</span>
                </span>
                <ChevronRight
                  className="text-muted-foreground h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              </a>
            )}

            {email && (
              <a
                href={`mailto:${email}`}
                data-testid="footer-email-link"
                className="text-foreground hover:text-primary focus-visible:ring-ring group flex min-h-11 items-center justify-between rounded-md px-1 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
              >
                <span className="flex items-center gap-3">
                  <Mail
                    className="text-muted-foreground group-hover:text-primary h-4 w-4 shrink-0 transition-colors"
                    aria-hidden="true"
                  />
                  <span className="font-medium">{email}</span>
                </span>
                <ChevronRight
                  className="text-muted-foreground h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              </a>
            )}

            {whatsappNumber && whatsappDigits && (
              <a
                href={`https://wa.me/${whatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="footer-whatsapp-link"
                className="text-foreground hover:text-primary focus-visible:ring-ring group flex min-h-11 items-center justify-between rounded-md px-1 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
              >
                <span className="flex items-center gap-3">
                  <MessageCircle
                    className="text-muted-foreground group-hover:text-primary h-4 w-4 shrink-0 transition-colors"
                    aria-hidden="true"
                  />
                  <span className="font-medium tabular-nums">{whatsappNumber}</span>
                </span>
                <ChevronRight
                  className="text-muted-foreground h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              </a>
            )}

            {address && (
              <div
                data-testid="footer-address"
                className="text-foreground flex min-h-11 items-center gap-3 px-1 py-1 text-xs"
              >
                <MapPin className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-medium">{address}</span>
              </div>
            )}

            <Link
              href={`/${locale}/info`}
              data-testid="footer-shop-info-link"
              className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-xs font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
            >
              <span>{dict.shopInfo}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Thin divider */}
        <hr className="border-border my-4 border-t" />

        {/* Row 2: Social links, conditional legal links, and dynamic copyright */}
        <div data-testid="footer-row-2" className="space-y-3">
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
            className="text-muted-foreground pt-0.5 text-xs tabular-nums"
          >
            © {currentYear} {displayName}
          </div>
        </div>
      </div>
    </footer>
  );
}
