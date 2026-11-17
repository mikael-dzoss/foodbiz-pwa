"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  Info,
  MessageSquare,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDate,
  formatMoney,
  formatPhoneNumber,
  formatTime,
  type CustomerSummary,
  type Dictionary,
  type Order,
} from "@/domain";
import type { ActionCode } from "@/lib/actions/types";
import { updateCustomerAction } from "../customer-actions";
import { CustomerMetrics } from "./customer-metrics";

const CUSTOMER_ERROR_KEYS: Partial<Record<ActionCode, "invalid" | "notFound">> = {
  VALIDATION: "invalid",
  NOT_FOUND: "notFound",
};

const statusVariants = {
  NEW: "new",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export function CustomerDetail({
  summary,
  orders,
  dict,
}: {
  summary: CustomerSummary;
  orders: Order[];
  dict: Dictionary;
}) {
  const text = dict.customers;
  const [limit, setLimit] = useState(20);
  const [guest, setGuest] = useState(summary.guest);
  const [name, setName] = useState(summary.guest.name);
  const [notes, setNotes] = useState(summary.guest.notes ?? "");
  const [result, action, pending] = useActionState(
    async (
      _previous: Awaited<ReturnType<typeof updateCustomerAction>> | null,
      formData: FormData,
    ) => {
      const saved = await updateCustomerAction({
        id: summary.guest.id,
        name: formData.get("name"),
        notes: formData.get("notes"),
      });
      if (saved.ok) {
        setGuest(saved.data);
        setName(saved.data.name);
        setNotes(saved.data.notes ?? "");
      }
      return saved;
    },
    null,
  );
  const errors = result && !result.ok ? result.fieldErrors : undefined;

  return (
    <section className="space-y-4" data-testid="customer-detail-screen">
      <div className="border-border bg-background sticky top-0 z-20 -mx-4 -mt-4 flex min-h-14 items-center border-b px-3 py-1 pt-[max(0.25rem,env(safe-area-inset-top))] md:static md:mx-0 md:mt-0 md:px-0">
        <Button asChild variant="ghost" className="h-11 gap-2 px-1 text-sm">
          <Link href="/manage/customers" aria-label={text.back} data-testid="back-to-customers">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            {text.title}
          </Link>
        </Button>
      </div>
      <header className="border-border bg-card space-y-4 rounded-xl border p-4">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="border-primary/20 bg-primary-soft text-primary-soft-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-lg font-semibold"
          >
            {guest.name
              .split(/\s+/u)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => Array.from(part)[0])
              .join("")
              .toLocaleUpperCase(dict.locale)}
          </div>
          <div className="min-w-0">
            <h1 className="text-title-md break-words">{guest.name}</h1>
            <p className="text-muted-foreground mt-1 text-xs tabular-nums">
              {guest.phone ? formatPhoneNumber(guest.phone) : text.noPhone}
            </p>
          </div>
        </div>
        {guest.phone && (
          <div className="border-border/60 grid grid-cols-2 gap-2 border-t pt-1">
            <Button asChild variant="outline" className="h-11 gap-2 font-semibold">
              <a href={`tel:${guest.phone}`} data-testid="customer-call">
                <Phone aria-hidden="true" className="text-primary h-4 w-4" />
                {text.call}
              </a>
            </Button>
            <Button asChild variant="outline" className="h-11 gap-2 font-semibold">
              <a
                href={`https://wa.me/${guest.phone.slice(1)}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="customer-whatsapp"
              >
                <MessageSquare aria-hidden="true" className="text-primary h-4 w-4" />
                {text.whatsapp}
              </a>
            </Button>
          </div>
        )}
      </header>
      <CustomerMetrics summary={summary} dict={text} locale={dict.locale} />
      <form
        action={action}
        className="border-border bg-card space-y-3.5 rounded-xl border p-4"
        data-testid="customer-edit-form"
      >
        <div className="border-border/60 flex items-start justify-between gap-3 border-b pb-1.5">
          <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase">
            <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
            {text.edit}
          </h2>
          <span className="text-muted-foreground text-xs">{text.internal}</span>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="customer-name" className="text-sm font-medium">
            {text.name}
          </label>
          <div className="relative">
            <Input
              id="customer-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              required
              autoComplete="name"
              className="h-11 pr-10"
              aria-invalid={Boolean(errors?.name)}
              aria-describedby={`customer-name-hint${errors?.name ? " customer-save-error" : ""}`}
              data-testid="customer-name-input"
            />
            <Pencil
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-3 right-3 h-4 w-4"
            />
          </div>
          <p id="customer-name-hint" className="text-muted-foreground text-xs leading-relaxed">
            {text.nameHint}
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="customer-notes" className="text-sm font-medium">
            {text.notes}
          </label>
          <Textarea
            id="customer-notes"
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={pending}
            maxLength={2000}
            rows={3}
            className="resize-y leading-relaxed"
            aria-invalid={Boolean(errors?.notes)}
            aria-describedby={`customer-notes-hint${errors?.notes ? " customer-save-error" : ""}`}
            data-testid="customer-notes-input"
          />
          <p id="customer-notes-hint" className="text-muted-foreground text-xs leading-relaxed">
            {text.notesHint}
          </p>
        </div>
        {result && !result.ok && (
          <p
            id="customer-save-error"
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm"
          >
            {text[CUSTOMER_ERROR_KEYS[result.code] ?? "saveFailed"]}
          </p>
        )}
        {result?.ok && (
          <p
            role="status"
            className="border-primary/20 bg-primary-soft text-primary-soft-foreground flex items-center gap-2 rounded-lg border p-3 text-sm"
          >
            <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
            {text.saved}
          </p>
        )}
        <Button
          type="submit"
          loading={pending}
          className="h-11 w-full gap-2 font-semibold"
          data-testid="customer-save-button"
        >
          <Check aria-hidden="true" className="h-4 w-4" />
          {text.save}
        </Button>
      </form>
      <section
        aria-labelledby="customer-history-title"
        className="space-y-2.5 pt-1"
        data-testid="customer-order-history"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 id="customer-history-title" className="text-sm font-semibold">
              {text.history}
            </h2>
            <span className="bg-muted text-muted-foreground rounded-full px-2 text-xs font-semibold tabular-nums">
              {orders.length.toLocaleString(dict.locale)}
            </span>
          </div>
          <span className="text-muted-foreground text-xs">{text.newestFirst}</span>
        </div>
        {orders.length === 0 ? (
          <p className="border-border bg-card text-muted-foreground rounded-xl border p-4 text-sm">
            {text.noOrders}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {orders.slice(0, limit).map((order) => {
              const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
              const mismatch = order.submittedName && order.submittedName !== guest.name;
              return (
                <li key={order.id}>
                  <Link
                    href={`/manage/orders/${order.id}`}
                    className="border-border bg-card hover:bg-muted active:bg-muted focus-visible:ring-ring block min-h-11 space-y-2.5 rounded-xl border p-3.5 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                    data-testid={`customer-order-${order.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold tabular-nums">
                            #{order.orderNumber ?? order.id.slice(0, 8)}
                          </span>
                          <Badge
                            variant={statusVariants[order.status]}
                            className="rounded-full px-2"
                            data-testid={`customer-order-status-${order.id}`}
                          >
                            {dict.orderTracking.statuses[order.status]}
                          </Badge>
                          <Badge variant={order.paid} className="rounded-full px-2">
                            {text[order.paid]}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          <time dateTime={order.createdAt}>
                            {formatDate(order.createdAt, dict.locale)} ·{" "}
                            {formatTime(order.createdAt, dict.locale)}
                          </time>{" "}
                          (
                          {order.serviceType === "pickup"
                            ? dict.storefront.servicePickup
                            : dict.storefront.serviceDelivery}
                          )
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-semibold tabular-nums">
                          {formatMoney(order.totalAmount, dict.locale)}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                          {itemCount.toLocaleString(dict.locale)}{" "}
                          {itemCount === 1 ? text.item : text.items}
                        </p>
                      </div>
                    </div>
                    <div className="border-border/60 flex items-start justify-between gap-2 border-t pt-2">
                      <p className="text-muted-foreground flex min-w-0 items-start gap-1.5 text-xs leading-5">
                        {mismatch ? (
                          <>
                            <Info
                              aria-hidden="true"
                              className="text-secondary mt-0.5 h-4 w-4 shrink-0"
                            />
                            <span className="text-secondary">
                              <span className="sr-only">{guest.name} · </span>
                              {text.orderedAs}{" "}
                              <span className="font-semibold">{order.submittedName}</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <UserRound aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                            <span className="break-words">{guest.name}</span>
                          </>
                        )}
                      </p>
                      <span className="text-primary flex shrink-0 items-center gap-1 text-xs leading-5 font-medium">
                        {text.viewOrder}
                        <ChevronRight aria-hidden="true" className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {orders.length > limit && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLimit(limit + 20)}
            data-testid="customer-orders-show-more"
          >
            {text.showMore}
          </Button>
        )}
      </section>
      <p className="text-muted-foreground pt-1 text-xs leading-relaxed">{text.spentHint}</p>
    </section>
  );
}
