"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KPICard, type KPICardProps } from "@/components/ui/kpi-card";
import {
  formatMoney,
  formatPercent,
  presentKpiDelta,
  type KpiDeltaMetric,
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

  const deltaFor = (metric: KpiDeltaMetric): KPICardProps["delta"] => {
    const shown = presentKpiDelta(metric, kpis.deltas?.[metric].percentage);
    if (!shown) return undefined;
    const words = dict.dashboard.kpi.delta;
    return {
      percentage: shown.magnitude,
      formatted: formatPercent(shown.magnitude, locale),
      direction: shown.direction,
      sentiment: shown.sentiment,
      srLabel:
        shown.direction === "flat"
          ? words.flat
          : `${words[shown.direction]}, ${words[shown.sentiment === "good" ? "good" : "bad"]}`,
      periodLabel: dict.dashboard.kpi.vsPreviousPeriod,
    };
  };

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
          <KPICard
            label={dict.dashboard.kpi.revenue}
            value={formatMoney(kpis.current.revenue, locale)}
            delta={deltaFor("revenue")}
            data-testid="kpi-revenue"
          />

          {/* Costs: a decrease is favourable, which presentKpiDelta encodes per metric */}
          <KPICard
            label={dict.dashboard.kpi.costs}
            value={formatMoney(kpis.current.costs, locale)}
            delta={deltaFor("costs")}
            data-testid="kpi-costs"
          />

          <KPICard
            label={dict.dashboard.kpi.profit}
            value={formatMoney(kpis.current.profit, locale)}
            delta={deltaFor("profit")}
            data-testid="kpi-profit"
          />

          <KPICard
            label={dict.dashboard.kpi.orders}
            value={`${kpis.current.paidOrderCount}`}
            delta={deltaFor("paidOrderCount")}
            data-testid="kpi-orders"
          />
        </div>

        {/* Average Order Value (AOV) Full Width */}
        <KPICard
          label={dict.dashboard.kpi.averageOrderValue}
          value={formatMoney(kpis.current.averageOrderValue, locale)}
          delta={deltaFor("averageOrderValue")}
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
