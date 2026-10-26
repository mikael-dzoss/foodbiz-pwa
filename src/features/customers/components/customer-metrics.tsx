import {
  formatDate,
  formatMoney,
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
  return (
    <dl className="grid grid-cols-3 gap-3 text-sm">
      <div>
        <dt className="text-muted-foreground">{dict.orders}</dt>
        <dd className="mt-1 font-semibold tabular-nums">{summary.orderCount}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{dict.totalSpent}</dt>
        <dd className="mt-1 font-semibold tabular-nums">
          {formatMoney(summary.totalSpent, locale)}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{dict.lastOrder}</dt>
        <dd className="mt-1 font-semibold">
          {summary.lastOrderDate ? formatDate(summary.lastOrderDate, locale) : dict.neverOrdered}
        </dd>
      </div>
    </dl>
  );
}
