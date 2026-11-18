"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeatureKey, emitFeatureInterest, getFeature } from "@/domain/features";
import { useManagerLocale } from "@/components/i18n";
import { useToast } from "@/components/ui";
import { SoonBadge } from "./soon-badge";

export interface SoonItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  featureKey: FeatureKey;
  title?: string;
  description?: string;
  toastMessage?: string;
  leading?: React.ReactNode;
  "data-testid"?: string;
}

export function SoonItem({
  featureKey,
  title,
  description,
  toastMessage,
  leading,
  className,
  "data-testid": testId,
  ...props
}: SoonItemProps) {
  const { showToast } = useToast();
  const { manager } = useManagerLocale().dict;
  const def = getFeature(featureKey);
  const localized = (
    manager.features as Partial<Record<FeatureKey, { title: string; description: string }>>
  )[featureKey];
  const displayTitle = title ?? localized?.title ?? def?.title ?? featureKey;
  const displayDesc = description ?? localized?.description ?? def?.description;

  const handleClick = () => {
    emitFeatureInterest(featureKey, { timestamp: Date.now() });
    showToast(toastMessage ?? manager.comingSoonToast);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "border-border bg-muted/40 flex min-h-14 cursor-pointer items-center justify-between gap-3 border-b px-4 py-3 text-left transition-colors",
        "hover:bg-muted/70 active:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
      data-testid={testId}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading && <div className="text-muted-foreground shrink-0">{leading}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-body-md text-muted-foreground truncate">{displayTitle}</span>
            <SoonBadge />
          </div>
          {displayDesc && (
            <p className="text-body-sm text-muted-foreground/80 truncate">{displayDesc}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ChevronRight className="text-muted-foreground/60 h-5 w-5" />
      </div>
      {/* Named from content (WCAG 2.5.3): the visible text plus this, so the name ends "(coming soon)". */}
      <span className="sr-only">({manager.comingSoon})</span>
    </div>
  );
}
