"use client";

import * as React from "react";
import Link from "next/link";
import { Receipt, Wallet, ChevronRight, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMoney, formatRelativeTime, type ActivityFeedItem } from "@/domain";
import { cn } from "@/lib/utils";

export interface RecentActivityFeedProps {
  items: readonly ActivityFeedItem[];
  /** Instant (ISO) the feed was built at; relative times are measured against it. */
  now: string;
  className?: string;
  labels?: {
    sectionTitle?: string;
    viewAll?: string;
    empty?: string;
  };
}

export function RecentActivityFeed({ items, now, className, labels }: RecentActivityFeedProps) {
  return (
    <section className={cn("space-y-3.5", className)} data-testid="recent-activity-section">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-base font-bold tracking-tight">
          {labels?.sectionTitle ?? "Recent activity"}
        </h2>
        <span className="text-muted-foreground text-xs">
          {items.length > 0 ? `${items.length} recent` : ""}
        </span>
      </div>

      <Card className="border-border bg-card overflow-hidden">
        {items.length > 0 ? (
          <div className="divide-border/40 divide-y" data-testid="activity-feed-list">
            {items.map((item) => {
              const isExpense = item.type === "expense";
              const relativeTime = formatRelativeTime(item.timestamp, now);

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
                        {item.title}
                      </span>
                      <span className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                        {item.subtitle ? `${item.subtitle} · ` : ""}
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
                        {isExpense ? `- ${formatMoney(item.amount)}` : formatMoney(item.amount)}
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
                        className="mt-0.5 px-1.5 py-0 text-[10px]"
                      >
                        {item.statusLabel}
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
            <p className="text-xs">{labels?.empty ?? "No recent activity yet"}</p>
          </div>
        )}
      </Card>
    </section>
  );
}
