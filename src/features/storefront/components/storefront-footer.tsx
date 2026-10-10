import Link from "next/link";
import { APP_METADATA } from "@/config/app";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";

export interface StorefrontFooterProps {
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function StorefrontFooter({ locale, dict }: StorefrontFooterProps) {
  return (
    <footer className="border-border bg-card mt-auto border-t py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-foreground text-sm font-semibold">{APP_METADATA.name}</span>
            <span className="text-muted-foreground text-xs">{APP_METADATA.description}</span>
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
            <Link
              href={`/${locale}/info`}
              className="hover:text-foreground inline-flex min-h-11 items-center transition-colors"
            >
              {dict.contact}
            </Link>
            <Link
              href={`/${locale}/legal/terms`}
              className="hover:text-foreground inline-flex min-h-11 items-center transition-colors"
            >
              {dict.terms}
            </Link>
            <Link
              href={`/${locale}/legal/privacy`}
              className="hover:text-foreground inline-flex min-h-11 items-center transition-colors"
            >
              {dict.privacy}
            </Link>
          </div>
        </div>

        <div className="border-border text-muted-foreground mt-6 border-t pt-4 text-center text-xs">
          © 2026 {APP_METADATA.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
