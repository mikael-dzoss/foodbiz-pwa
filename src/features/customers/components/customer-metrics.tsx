import { useBusinessTimeZone } from "@/components/time/business-timezone";
import {
  formatDate,
  getZonedParts,
  formatMoney,
  formatTime,
  type CustomerSummary,
  type CustomersDictionary,
  type SupportedLocale,
} from "@/domain";

export function CustomerMetrics({
  summary,
  dict,
  locale,
}: {
  summary: CustomerSummary;
  dict: CustomersDictionary;
  locale: SupportedLocale;
}) {
  const timeZone = useBusinessTimeZone();
  return (
    <dl className="grid grid-cols-3 gap-2" data-testid="customer-metrics">
      <div className="border-border bg-card flex min-w-0 flex-col justify-between rounded-xl border p-3">
        <dt className="text-muted-foreground text-xs font-medium uppercase">{dict.orders}</dt>
        <dd className="mt-2">
          <span className="text-xl font-semibold tabular-nums">
            {summary.orderCount.toLocaleString(locale)}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs">{dict.lifetime}</span>
        </dd>
      </div>
      <div className="border-border bg-card flex min-w-0 flex-col justify-between rounded-xl border p-3">
        <dt className="text-muted-foreground text-xs font-medium uppercase">{dict.totalSpent}</dt>
        <dd className="mt-2">
          <span className="text-xl font-semibold break-words tabular-nums">
            {formatMoney(summary.totalSpent, locale)}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs">{dict.paidOrders}</span>
        </dd>
      </div>
      <div className="border-border bg-card flex min-w-0 flex-col justify-between rounded-xl border p-3">
        <dt className="text-muted-foreground text-xs font-medium uppercase">{dict.lastOrder}</dt>
        <dd className="mt-2">
          {summary.lastOrderDate ? (
            <time
              dateTime={summary.lastOrderDate}
              title={formatDate(summary.lastOrderDate, timeZone, locale)}
            >
              <span className="text-sm font-semibold tabular-nums">
                {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
                  day: "numeric",
                  month: "short",
                  timeZone,
                }).format(new Date(summary.lastOrderDate))}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs tabular-nums">
                {getZonedParts(summary.lastOrderDate, timeZone).year} ·{" "}
                {formatTime(summary.lastOrderDate, timeZone, locale)}
              </span>
            </time>
          ) : (
            <span className="text-sm font-medium">{dict.neverOrdered}</span>
          )}
        </dd>
      </div>
    </dl>
  );
}
