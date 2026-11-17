"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ChevronRight,
  History,
  Info,
  Menu,
  PackageSearch,
  Share2,
  ShoppingBag,
} from "lucide-react";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { SoonBadge } from "@/components/feedback";
import { useToastOptional } from "@/components/ui";
import { useCartOptional } from "../context/cart-context";

export interface StorefrontMenuDrawerProps {
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  businessName: string;
  /** Extra content pinned to the drawer bottom (e.g. install app, #232). */
  footer?: ReactNode;
}

const ROW =
  "hover:bg-muted focus-visible:ring-ring flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden";

function RowIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="border-border bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

export function StorefrontMenuDrawer({
  locale,
  dict,
  businessName,
  footer,
}: StorefrontMenuDrawerProps) {
  const [open, setOpen] = useState(false);
  const cartCount = useCartOptional()?.totalCount ?? 0;
  const toast = useToastOptional();

  const handleShare = async () => {
    const url = `${window.location.origin}/${locale}`;
    setOpen(false);
    if (navigator.share) {
      try {
        await navigator.share({ title: businessName, url });
      } catch {
        // Share sheet dismissed
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast?.showToast(dict.linkCopied);
    } catch {
      toast?.showToast(url);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={dict.menuOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="storefront-menu-button"
        className="text-foreground hover:bg-muted focus-visible:ring-ring -ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
      <SheetContent side="left" data-testid="storefront-menu-drawer" className="gap-0 p-4">
        <div className="border-border mb-3 flex items-center gap-3 border-b pr-10 pb-4">
          <span
            className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            aria-hidden="true"
          >
            {businessName.charAt(0).toUpperCase()}
          </span>
          <SheetTitle>{businessName}</SheetTitle>
        </div>
        <SheetDescription className="sr-only">{dict.menuDrawerTitle}</SheetDescription>

        <nav aria-label={dict.menuDrawerTitle} className="flex-1 overflow-y-auto">
          <ul className="flex flex-col gap-1">
            <li>
              <SheetClose asChild>
                <Link href={`/${locale}/track`} className={ROW} data-testid="menu-track-order">
                  <RowIcon>
                    <PackageSearch className="h-4 w-4" />
                  </RowIcon>
                  <span className="flex-1">{dict.menuTrackOrder}</span>
                  <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                </Link>
              </SheetClose>
            </li>
            <li>
              {/* TODO(customers): enable once WhatsApp OTP order history ships (#235) */}
              <button
                type="button"
                disabled
                aria-label={`${dict.orderHistory} (${dict.soon})`}
                data-testid="menu-order-history"
                className={`${ROW} text-muted-foreground cursor-not-allowed hover:bg-transparent`}
              >
                <RowIcon>
                  <History className="h-4 w-4" />
                </RowIcon>
                <span className="flex-1">{dict.orderHistory}</span>
                <SoonBadge label={dict.soon} />
              </button>
            </li>
            <li>
              <SheetClose asChild>
                <Link href={`/${locale}/cart`} className={ROW} data-testid="menu-view-cart">
                  <RowIcon>
                    <ShoppingBag className="h-4 w-4" />
                  </RowIcon>
                  <span className="flex-1">{dict.viewCart}</span>
                  {cartCount > 0 && (
                    <span
                      data-testid="menu-cart-count"
                      className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums"
                    >
                      <span className="sr-only">{`${cartCount} ${cartCount === 1 ? dict.item : dict.items}`}</span>
                      <span aria-hidden="true">{cartCount}</span>
                    </span>
                  )}
                  <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                </Link>
              </SheetClose>
            </li>
            <li>
              <button type="button" onClick={handleShare} className={ROW} data-testid="menu-share">
                <RowIcon>
                  <Share2 className="h-4 w-4" />
                </RowIcon>
                <span className="flex-1">{dict.shareShopLink}</span>
                <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden="true" />
              </button>
            </li>
            <li>
              <SheetClose asChild>
                <Link href={`/${locale}/info`} className={ROW} data-testid="menu-about">
                  <RowIcon>
                    <Info className="h-4 w-4" />
                  </RowIcon>
                  <span className="flex-1">
                    {dict.aboutBusiness.replace("{business}", businessName)}
                  </span>
                  <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                </Link>
              </SheetClose>
            </li>
          </ul>
        </nav>
        {footer}
      </SheetContent>
    </Sheet>
  );
}
