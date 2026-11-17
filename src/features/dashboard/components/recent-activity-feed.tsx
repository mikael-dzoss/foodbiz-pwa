"use client";

import * as React from "react";
import Link from "next/link";
import { Receipt, Wallet, ChevronRight, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMoney, formatRelativeTime, type ActivityFeedItem } from "@/domain";
import { useManagerLocale } from "@/components/i18n";
import { interpolate } from "@/domain/i18n";
import { cn } from "@/lib/utils";

export interface RecentActivityFeedProps {
  items: readonly ActivityFeedItem[];
  /** Instant (ISO) the feed was built at; relative times are measured against it. */
  now: string;
  className?: string;
}

export function RecentActivityFeed({ items, now, className }: RecentActivityFeedProps) {
  const { locale, dict } = useManagerLocale();
  const labels = dict.dashboard.activity;
  const orderTexts = dict.orders;
  return (
    <section className={cn("space-y-3.5", className)} data-testid="recent-activity-section">
      <div className="flex items-center justify-between">
        <h2 className="text-title-sm text-foreground">{labels.sectionTitle}</h2>
        <span className="text-muted-foreground text-xs">
          {items.length > 0 ? interpolate(labels.recentCount, { count: items.length }) : ""}
        </span>
      </div>

      <Card className="border-border bg-card overflow-hidden">
        {items.length > 0 ? (
          <div className="divide-border/40 divide-y" data-testid="activity-feed-list">
            {items.map((item) => {
              const isExpense = item.type === "expense";
              const statusText = labels[item.statusKey];
              const title = isExpense
                ? item.description
                : item.orderNumber
                  ? interpolate(labels.orderTitle, { number: item.orderNumber })
                  : interpolate(labels.orderTitleGuest, { guest: item.guestName ?? "" });
              const subtitle = isExpense
                ? item.tags
                : interpolate(item.paymentMethod ? labels.guestPaidVia : labels.guestStatus, {
                    guest: item.guestName ?? "",
                    status: statusText,
                    method: item.paymentMethod ? orderTexts.paymentMethods[item.paymentMethod] : "",
                  });
              const relativeTime = formatRelativeTime(item.timestamp, now, locale);

              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  className="hover:bg-muted/50 active:bg-muted flex items-center justify-between p-3.5 transition-colors"
                  data-testid={`activity-item-${item.type}-${item.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs",
                        isExpense
                          ? "bg-muted text-muted-foreground"
                          : item.statusVariant === "paid"
                            ? "bg-primary-soft text-primary-soft-foreground"
                            : "bg-warning-soft text-warning-soft-foreground",
                      )}
                    >
                      {isExpense ? <Wallet className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-foreground line-clamp-1 text-sm font-semibold">
                        {title}
                      </span>
                      <span className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                        {subtitle ? `${subtitle} · ` : ""}
                        {relativeTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-2">
                    <div className="flex flex-col items-end">
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          isExpense ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {isExpense
                          ? `- ${formatMoney(item.amount, locale)}`
                          : formatMoney(item.amount, locale)}
                      </span>
                      <Badge
                        variant={
                          item.statusVariant === "paid"
                            ? "paid"
                            : item.statusVariant === "unpaid"
                              ? "unpaid"
                              : item.statusVariant === "cancelled"
                                ? "cancelled"
                                : "outline"
                        }
                        className="text-micro mt-0.5 px-1.5 py-0"
                      >
                        {statusText}
                      </Badge>
                    </div>
                    <ChevronRight className="text-muted-foreground h-4 w-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center justify-center p-8 text-center">
            <Activity className="text-muted-foreground/60 mb-2 h-8 w-8" />
            <p className="text-xs">{labels.empty}</p>
          </div>
        )}
      </Card>
    </section>
  );
}
