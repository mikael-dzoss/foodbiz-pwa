"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatPhoneNumber,
  type CustomerSummary,
  type CustomersDictionary,
  type SupportedLocale,
} from "@/domain";
import { CustomerMetrics } from "./customer-metrics";

export function CustomerList({
  customers,
  dict,
  locale,
}: {
  customers: CustomerSummary[];
  dict: CustomersDictionary;
  locale: SupportedLocale;
}) {
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
    <section className="space-y-5" data-testid="customer-list-screen">
      <header>
        <h1 className="text-2xl font-bold">{dict.title}</h1>
        <p className="text-muted-foreground mt-1">{dict.subtitle}</p>
      </header>
      <div className="relative">
        <label className="sr-only" htmlFor="customer-search">
          {dict.search}
        </label>
        <Search
          className="text-muted-foreground pointer-events-none absolute top-4 left-3 h-4 w-4"
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
          className="pl-10"
          data-testid="customer-search-input"
        />
      </div>
      <p className="text-muted-foreground text-xs">{dict.spentHint}</p>
      {filtered.length === 0 ? (
        <div role="status" className="border-border bg-card rounded-xl border p-6 text-center">
          <Users aria-hidden="true" className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          {customers.length === 0 ? dict.empty : dict.noResults}
        </div>
      ) : (
        <ul className="space-y-3" data-testid="customer-list">
          {filtered.slice(0, limit).map((summary) => (
            <li key={summary.guest.id}>
              <Link
                href={`/manage/customers/${summary.guest.id}`}
                className="border-border bg-card hover:bg-muted active:bg-muted focus-visible:ring-ring block min-h-11 rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                data-testid={`customer-${summary.guest.id}`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold break-words">{summary.guest.name}</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {summary.guest.phone ? formatPhoneNumber(summary.guest.phone) : dict.noPhone}
                    </p>
                  </div>
                  <ChevronRight
                    aria-hidden="true"
                    className="text-muted-foreground h-5 w-5 shrink-0"
                  />
                </div>
                <CustomerMetrics summary={summary} dict={dict} locale={locale} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {filtered.length > limit && (
        <Button
          variant="outline"
          onClick={() => setLimit(limit + 20)}
          data-testid="customers-show-more"
        >
          {dict.showMore}
        </Button>
      )}
    </section>
  );
}
