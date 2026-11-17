"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownUp, ChevronRight, Search, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBusinessTimeZone } from "@/components/time/business-timezone";
import {
  formatPhoneNumber,
  formatDate,
  formatMoney,
  type CustomerSummary,
  type CustomersDictionary,
  type SupportedLocale,
} from "@/domain";

export function CustomerList({
  customers,
  dict,
  locale,
}: {
  customers: CustomerSummary[];
  dict: CustomersDictionary;
  locale: SupportedLocale;
}) {
  const timeZone = useBusinessTimeZone();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(20);
  const query = search.trim().toLocaleLowerCase(locale);
  const digits = query.replace(/\D/g, "");
  const filtered = customers.filter(({ guest }) => {
    if (guest.name.toLocaleLowerCase(locale).includes(query)) return true;
    if (!guest.phone) return false;
    return (
      guest.phone.includes(query) ||
      (digits.length >= 3 &&
        [guest.phone, formatPhoneNumber(guest.phone, "national")].some((phone) =>
          phone.replace(/\D/g, "").includes(digits),
        ))
    );
  });

  return (
    <section className="space-y-4" data-testid="customer-list-screen">
      <header className="border-border bg-background pt-safe-min-1 sticky top-0 z-20 -mx-4 -mt-4 flex min-h-14 items-center gap-5 border-b px-4 py-1 md:static md:mx-0 md:mt-0 md:px-0">
        <Store aria-hidden="true" className="text-muted-foreground h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-title-md">{dict.title}</h1>
          <p className="text-muted-foreground text-xs">{dict.subtitle}</p>
        </div>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
          {customers.length.toLocaleString(locale)}
        </span>
      </header>
      <div className="space-y-2.5">
        <div className="relative">
          <label className="sr-only" htmlFor="customer-search">
            {dict.search}
          </label>
          <Search
            className="text-muted-foreground pointer-events-none absolute top-3 left-3.5 h-5 w-5"
            aria-hidden="true"
          />
          <Input
            id="customer-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(20);
            }}
            placeholder={dict.search}
            className="h-11 pl-10"
            data-testid="customer-search-input"
          />
        </div>
        <div className="text-muted-foreground flex items-start justify-between gap-3 text-xs">
          <p data-testid="customer-results-count">
            {(filtered.length === 1 ? dict.listedSingular : dict.listedPlural).replace(
              "{count}",
              filtered.length.toLocaleString(locale),
            )}
          </p>
          <p className="flex items-center gap-1 text-right font-medium">
            <ArrowDownUp aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {dict.sortedByRecent}
          </p>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div role="status" className="border-border bg-card rounded-xl border p-6 text-center">
          <Users aria-hidden="true" className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          {customers.length === 0 ? dict.empty : dict.noResults}
        </div>
      ) : (
        <ul
          className="border-border divide-border bg-card divide-y overflow-hidden rounded-xl border"
          data-testid="customer-list"
        >
          {filtered.slice(0, limit).map((summary) => (
            <li key={summary.guest.id}>
              <Link
                href={`/manage/customers/${summary.guest.id}`}
                className="hover:bg-muted active:bg-muted focus-visible:ring-ring group grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 p-3.5 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none"
                data-testid={`customer-${summary.guest.id}`}
              >
                <div className="min-w-0 flex-1">
                  <h2 className="text-label-md group-hover:text-primary truncate">
                    {summary.guest.name}
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                    {summary.guest.phone ? formatPhoneNumber(summary.guest.phone) : dict.noPhone}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end">
                  <dl>
                    <dt className="sr-only">{dict.totalSpent}</dt>
                    <dd className="text-sm font-semibold tabular-nums">
                      {formatMoney(summary.totalSpent, locale)}
                    </dd>
                  </dl>
                  <ChevronRight
                    aria-hidden="true"
                    className="text-muted-foreground/60 group-hover:text-foreground h-5 w-5 shrink-0"
                  />
                </div>
                <dl className="text-muted-foreground col-span-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <div>
                    <dt className="sr-only">{dict.orders}</dt>
                    <dd className="tabular-nums">
                      {summary.orderCount.toLocaleString(locale)}{" "}
                      {summary.orderCount === 1
                        ? dict.order
                        : dict.orders.toLocaleLowerCase(locale)}
                    </dd>
                  </div>
                  <div className="before:bg-border flex items-center gap-1 before:mr-1 before:h-1 before:w-1 before:rounded-full">
                    <dt>{dict.last}:</dt>
                    <dd className="tabular-nums">
                      {summary.lastOrderDate
                        ? formatDate(summary.lastOrderDate, timeZone, locale)
                        : dict.neverOrdered}
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {filtered.length > limit && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setLimit(limit + 20)}
          data-testid="customers-show-more"
        >
          {dict.showMore}
        </Button>
      )}
      <p className="text-muted-foreground pt-2 text-xs leading-relaxed">{dict.spentHint}</p>
    </section>
  );
}
