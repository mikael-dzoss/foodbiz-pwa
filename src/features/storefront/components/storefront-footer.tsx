"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";

export interface StorefrontFooterProps {
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  businessName?: string;
}

export function StorefrontFooter({
  locale,
  dict,
  businessName = "La Petite Boulangerie",
}: StorefrontFooterProps) {
  const pathname = usePathname();
  const currentYear = 2026;

  // Hide footer on Info page and Product detail view (anchored bottom action bars present)
  if (pathname && (pathname.includes("/info") || pathname.includes("/p/"))) {
    return null;
  }

  return (
    <footer className="border-border bg-card mt-auto border-t py-6">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-4 text-xs">
            <Link
              href={`/${locale}/info`}
              className="hover:text-foreground inline-flex min-h-9 items-center transition-colors"
            >
              {dict.contact}
            </Link>
            <Link
              href={`/${locale}/legal/terms`}
              className="hover:text-foreground inline-flex min-h-9 items-center transition-colors"
            >
              {dict.terms}
            </Link>
            <Link
              href={`/${locale}/legal/privacy`}
              className="hover:text-foreground inline-flex min-h-9 items-center transition-colors"
            >
              {dict.privacy}
            </Link>
          </div>

          <div className="text-muted-foreground text-xs tabular-nums">
            © {currentYear} {businessName}. {dict.allRightsReserved ?? "All rights reserved."}
          </div>
        </div>
      </div>
    </footer>
  );
}
