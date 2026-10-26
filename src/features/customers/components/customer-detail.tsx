"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDate,
  formatMoney,
  formatPhoneNumber,
  type CustomerSummary,
  type Dictionary,
  type Order,
} from "@/domain";
import { updateCustomerAction, type CustomerActionResult } from "../customer-actions";
import { CustomerMetrics } from "./customer-metrics";

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
    async (_previous: CustomerActionResult | null, formData: FormData) => {
      const saved = await updateCustomerAction({
        id: summary.guest.id,
        name: formData.get("name"),
        notes: formData.get("notes"),
      });
      if (saved.success) {
        setGuest(saved.data);
        setName(saved.data.name);
        setNotes(saved.data.notes ?? "");
      }
      return saved;
    },
    null,
  );
  const errors = result && !result.success ? result.fieldErrors : undefined;

  return (
    <section className="space-y-5" data-testid="customer-detail-screen">
      <Button asChild variant="ghost">
        <Link href="/manage/customers" data-testid="back-to-customers">
          <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
          {text.back}
        </Link>
      </Button>
      <header className="border-border bg-card space-y-4 rounded-xl border p-4">
        <div>
          <h1 className="text-2xl font-bold break-words">{guest.name}</h1>
          <p className="text-muted-foreground mt-1">
            {guest.phone ? formatPhoneNumber(guest.phone) : text.noPhone}
          </p>
        </div>
        {guest.phone && (
          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline">
              <a href={`tel:${guest.phone}`} data-testid="customer-call">
                <Phone aria-hidden="true" className="mr-2 h-4 w-4" />
                {text.call}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                href={`https://wa.me/${guest.phone.slice(1)}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="customer-whatsapp"
              >
                <MessageSquare aria-hidden="true" className="mr-2 h-4 w-4" />
                {text.whatsapp}
              </a>
            </Button>
          </div>
        )}
        <CustomerMetrics summary={summary} dict={text} locale={dict.locale} />
        <p className="text-muted-foreground text-xs">{text.spentHint}</p>
      </header>
      <form
        action={action}
        className="border-border bg-card space-y-4 rounded-xl border p-4"
        data-testid="customer-edit-form"
      >
        <h2 className="text-lg font-semibold">{text.edit}</h2>
        <div className="space-y-2">
          <label htmlFor="customer-name" className="text-sm font-medium">
            {text.name}
          </label>
          <Input
            id="customer-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={pending}
            required
            autoComplete="name"
            aria-invalid={Boolean(errors?.name)}
            aria-describedby={`customer-name-hint${errors?.name ? " customer-save-error" : ""}`}
            data-testid="customer-name-input"
          />
          <p id="customer-name-hint" className="text-muted-foreground text-sm">
            {text.nameHint}
          </p>
        </div>
        <div className="space-y-2">
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
            rows={4}
            aria-invalid={Boolean(errors?.notes)}
            aria-describedby={`customer-notes-hint${errors?.notes ? " customer-save-error" : ""}`}
            data-testid="customer-notes-input"
          />
          <p id="customer-notes-hint" className="text-muted-foreground text-sm">
            {text.notesHint}
          </p>
        </div>
        {result && !result.success && (
          <p id="customer-save-error" role="alert" className="text-destructive">
            {text[result.error]}
          </p>
        )}
        {result?.success && (
          <p role="status" className="text-primary">
            {text.saved}
          </p>
        )}
        <Button type="submit" loading={pending} data-testid="customer-save-button">
          {text.save}
        </Button>
      </form>
      <section
        aria-labelledby="customer-history-title"
        className="space-y-3"
        data-testid="customer-order-history"
      >
        <h2 id="customer-history-title" className="text-lg font-semibold">
          {text.history}
        </h2>
        {orders.length === 0 ? (
          <p className="text-muted-foreground">{text.noOrders}</p>
        ) : (
          <ul className="space-y-3">
            {orders.slice(0, limit).map((order) => (
              <li key={order.id}>
                <Link
                  href={`/manage/orders/${order.id}`}
                  className="border-border bg-card hover:bg-muted active:bg-muted focus-visible:ring-ring block min-h-11 space-y-2 rounded-xl border p-4 focus-visible:ring-2 focus-visible:outline-none"
                  data-testid={`customer-order-${order.id}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                    <span>
                      #{order.orderNumber ?? order.id.slice(0, 8)} · {guest.name}
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(order.totalAmount, dict.locale)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {formatDate(order.createdAt, dict.locale)} ·{" "}
                    {dict.orderTracking.statuses[order.status]} · {text[order.paid]}
                  </p>
                  {order.submittedName && order.submittedName !== guest.name && (
                    <p className="text-muted-foreground text-sm">
                      {text.orderedAs} {order.submittedName}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {orders.length > limit && (
          <Button
            variant="outline"
            onClick={() => setLimit(limit + 20)}
            data-testid="customer-orders-show-more"
          >
            {text.showMore}
          </Button>
        )}
      </section>
    </section>
  );
}
