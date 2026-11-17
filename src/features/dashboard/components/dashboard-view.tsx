"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KPICard } from "@/components/ui/kpi-card";
import {
  formatMoney,
  formatPercent,
  type DashboardData,
  type DashboardPeriodPreset,
} from "@/domain";
import { useManagerLocale } from "@/components/i18n";
import { PeriodPicker } from "./period-picker";
import { OperationalWidgets } from "./operational-widgets";
import { RecentActivityFeed } from "./recent-activity-feed";
import { cn } from "@/lib/utils";

export interface DashboardViewProps {
  initialData: DashboardData;
  className?: string;
}

export function DashboardView({ initialData, className }: DashboardViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  // The period lives in the URL: the server data is the truth; the tapped tab only shows while pending.
  const [pendingPeriod, setPendingPeriod] = React.useState(initialData.periodPreset);
  const period = isPending ? pendingPeriod : initialData.periodPreset;
  const data = initialData;

  const { locale, dict } = useManagerLocale();

  const handlePeriodChange = (newPeriod: DashboardPeriodPreset) => {
    setPendingPeriod(newPeriod);
    startTransition(() => {
      router.replace(`/manage?period=${newPeriod}`, { scroll: false });
    });
  };

  const { kpis, triage, activity } = data;

  return (
    <div
      className={cn("space-y-6 pb-12 transition-opacity", isPending && "opacity-70", className)}
      data-testid="manager-dashboard-view"
    >
      {/* Top Header Row */}
      <header className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-title-lg text-foreground">{dict.dashboard.title}</h1>
            <p className="text-muted-foreground text-xs font-normal">{dict.dashboard.subtitle}</p>
          </div>
          <span className="bg-primary-soft text-primary-soft-foreground text-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium">
            <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
            {dict.dashboard.activeStatus}
          </span>
        </div>

        {/* Period Selector Tabs */}
        <PeriodPicker
          value={period}
          onChange={handlePeriodChange}
          disabled={isPending}
          labels={dict.dashboard.periods}
          ariaLabel={dict.dashboard.periodPickerLabel}
        />
      </header>

      {/* KPI Cards Grid (2 columns on mobile + full-width AOV) */}
      <section
        id="kpi-panel"
        role="region"
        aria-label={dict.dashboard.kpiRegionLabel}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          {/* Revenue */}
          <KPICard
            label={dict.dashboard.kpi.revenue}
            value={formatMoney(kpis.current.revenue, locale)}
            delta={
              kpis.deltas?.revenue.percentage !== null &&
              kpis.deltas?.revenue.percentage !== undefined
                ? {
                    percentage: Math.abs(kpis.deltas.revenue.percentage),
                    formatted: formatPercent(Math.abs(kpis.deltas.revenue.percentage), locale),
                    isPositive: kpis.deltas.revenue.percentage >= 0,
                    periodLabel: dict.dashboard.kpi.vsPreviousPeriod,
                  }
                : undefined
            }
            data-testid="kpi-revenue"
          />

          {/* Costs (cost reduction is positive for business) */}
          <KPICard
            label={dict.dashboard.kpi.costs}
            value={formatMoney(kpis.current.costs, locale)}
            delta={
              kpis.deltas?.costs.percentage !== null && kpis.deltas?.costs.percentage !== undefined
                ? {
                    percentage: Math.abs(kpis.deltas.costs.percentage),
                    formatted: formatPercent(Math.abs(kpis.deltas.costs.percentage), locale),
                    isPositive: kpis.deltas.costs.percentage <= 0,
                    periodLabel: dict.dashboard.kpi.vsPreviousPeriod,
                  }
                : undefined
            }
            data-testid="kpi-costs"
          />

          {/* Profit */}
          <KPICard
            label={dict.dashboard.kpi.profit}
            value={formatMoney(kpis.current.profit, locale)}
            delta={
              kpis.deltas?.profit.percentage !== null &&
              kpis.deltas?.profit.percentage !== undefined
                ? {
                    percentage: Math.abs(kpis.deltas.profit.percentage),
                    formatted: formatPercent(Math.abs(kpis.deltas.profit.percentage), locale),
                    isPositive: kpis.deltas.profit.percentage >= 0,
                    periodLabel: dict.dashboard.kpi.vsPreviousPeriod,
                  }
                : undefined
            }
            data-testid="kpi-profit"
          />

          {/* Orders Count */}
          <KPICard
            label={dict.dashboard.kpi.orders}
            value={`${kpis.current.paidOrderCount}`}
            delta={
              kpis.deltas?.paidOrderCount.percentage !== null &&
              kpis.deltas?.paidOrderCount.percentage !== undefined
                ? {
                    percentage: Math.abs(kpis.deltas.paidOrderCount.percentage),
                    formatted: formatPercent(
                      Math.abs(kpis.deltas.paidOrderCount.percentage),
                      locale,
                    ),
                    isPositive: kpis.deltas.paidOrderCount.percentage >= 0,
                    periodLabel: dict.dashboard.kpi.vsPreviousPeriod,
                  }
                : undefined
            }
            data-testid="kpi-orders"
          />
        </div>

        {/* Average Order Value (AOV) Full Width */}
        <KPICard
          label={dict.dashboard.kpi.averageOrderValue}
          value={formatMoney(kpis.current.averageOrderValue, locale)}
          delta={
            kpis.deltas?.averageOrderValue.percentage !== null &&
            kpis.deltas?.averageOrderValue.percentage !== undefined
              ? {
                  percentage: Math.abs(kpis.deltas.averageOrderValue.percentage),
                  formatted: formatPercent(
                    Math.abs(kpis.deltas.averageOrderValue.percentage),
                    locale,
                  ),
                  isPositive: kpis.deltas.averageOrderValue.percentage >= 0,
                  periodLabel: dict.dashboard.kpi.vsPreviousPeriod,
                }
              : undefined
          }
          className="w-full"
          data-testid="kpi-average-order-value"
        />
      </section>

      {/* Operational Triage Section */}
      <OperationalWidgets triage={triage} />

      {/* Recent Activity Feed Section */}
      <RecentActivityFeed items={activity} now={initialData.generatedAt} />
    </div>
  );
}
