"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting";
import { cn } from "@/lib/utils";

export interface MinimumOrderBannerProps {
  subtotalInCents: number;
  minOrderAmountInCents: number;
  dict: StorefrontDictionary;
  locale?: SupportedLocale;
  className?: string;
}

export function MinimumOrderBanner({
  subtotalInCents,
  minOrderAmountInCents,
  dict,
  locale = "en",
  className,
}: MinimumOrderBannerProps) {
  if (minOrderAmountInCents <= 0) {
    return null;
  }

  const isReached = subtotalInCents >= minOrderAmountInCents;
  const progressPercent = Math.min(
    100,
    Math.round((subtotalInCents / minOrderAmountInCents) * 100),
  );
  const shortfall = Math.max(0, minOrderAmountInCents - subtotalInCents);

  return (
    <div
      data-testid="minimum-order-banner"
      className={cn(
        "border-border bg-card flex flex-col gap-2 rounded-xl border p-4 shadow-2xs transition-colors",
        className,
      )}
    >
      <div className="flex items-center justify-between text-xs font-medium sm:text-sm">
        <span className="text-muted-foreground">{dict.minimumOrderProgress}</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            isReached ? "text-primary" : "text-foreground",
          )}
        >
          {formatMoney(subtotalInCents, locale)} / {formatMoney(minOrderAmountInCents, locale)}
        </span>
      </div>

      {/* Progress Track */}
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          data-testid="minimum-order-progress-bar"
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isReached ? "bg-primary" : "bg-primary/80",
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Status Notice */}
      {isReached ? (
        <div className="bg-primary/10 text-primary mt-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{dict.minimumOrderReached}</span>
        </div>
      ) : (
        <div className="border-warning-soft bg-warning-soft/30 text-foreground mt-1 flex items-start gap-2 rounded-lg border p-2.5 text-xs">
          <AlertCircle className="text-secondary mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-relaxed">
            {dict.addMoreForMinimum.replace("{amount}", formatMoney(shortfall, locale))}
          </span>
        </div>
      )}
    </div>
  );
}
