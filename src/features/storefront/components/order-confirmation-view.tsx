import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BusinessSettings } from "@/domain/business";
import type { PublicOrder } from "@/domain/order";
import type { Dictionary, SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting";
import { CopyPaymentRecipient } from "./copy-payment-recipient";

export function OrderConfirmationView({
  order,
  settings,
  businessName,
  token,
  locale,
  dict,
}: {
  order: PublicOrder;
  settings: Pick<
    BusinessSettings,
    "revolutRevtag" | "weroIdentifier" | "paymentInstructionsEn" | "paymentInstructionsFr"
  > | null;
  businessName: string;
  token: string;
  locale: SupportedLocale;
  dict: Dictionary;
}) {
  const copy = dict.orderConfirmation;
  const tracking = dict.orderTracking;
  const reference = `#${order.orderNumber ?? "—"}`;
  const method = order.paymentPreference;
  const recipient = method === "revolut" ? settings?.revolutRevtag : settings?.weroIdentifier;
  const instructions =
    locale === "fr" ? settings?.paymentInstructionsFr : settings?.paymentInstructionsEn;
  const needsPayment = order.paid === "unpaid" && order.status !== "CANCELLED";
  const paymentStatus =
    order.paid === "paid"
      ? tracking.paidBadge
      : order.paid === "refunded"
        ? tracking.refundedBadge
        : tracking.unpaidBadge;

  return (
    <div className="mx-auto w-full max-w-md space-y-5" data-testid="order-confirmation-view">
      <header className="border-border bg-card space-y-3 rounded-lg border p-4 text-center">
        <p className="text-muted-foreground text-sm">{businessName}</p>
        <CheckCircle2 className="text-primary mx-auto h-12 w-12" aria-hidden="true" />
        <h1 className="text-xl font-bold">{copy.title}</h1>
        <Badge variant={order.status === "CANCELLED" ? "cancelled" : "outline"}>
          {order.status === "NEW" ? copy.awaiting : tracking.statuses[order.status]}
        </Badge>
        <p className="text-primary font-semibold" data-testid="confirmation-order-reference">
          {tracking.orderReference} {reference}
        </p>
        {order.status === "NEW" && (
          <p className="text-muted-foreground text-sm">{copy.receivedHelp}</p>
        )}
      </header>

      <section
        className="border-border bg-card space-y-3 rounded-lg border p-4"
        aria-labelledby="confirmation-summary"
      >
        <h2 id="confirmation-summary" className="font-semibold">
          {tracking.orderSummary}
        </h2>
        <ul className="divide-border divide-y">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between gap-3 py-3 text-sm">
              <span>
                {item.quantity} × <span>{item.productName}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatMoney(item.totalPrice, locale)}</span>
            </li>
          ))}
        </ul>
        <div className="border-border flex justify-between gap-3 border-t pt-3 font-semibold">
          <span>{tracking.totalAmount}</span>
          <span className="text-primary tabular-nums">
            {formatMoney(order.totalAmount, locale)}
          </span>
        </div>
      </section>

      <section
        className="border-border bg-card space-y-3 rounded-lg border p-4"
        aria-labelledby="confirmation-payment-title"
        data-testid="confirmation-payment"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="confirmation-payment-title" className="font-semibold">
            {copy.paymentTitle}
          </h2>
          <Badge variant={order.paid === "paid" ? "paid" : "unpaid"}>{paymentStatus}</Badge>
        </div>
        {needsPayment ? (
          <>
            {method === "on_handover" ? (
              <>
                <p className="text-sm">{copy.handover}</p>
                <ImportantNote testId="confirmation-handover-prepare">
                  {copy.handoverPrepare}
                </ImportantNote>
              </>
            ) : recipient?.trim() ? (
              <>
                <p className="font-semibold">{method === "revolut" ? "Revolut" : "Wero"}</p>
                <dl className="bg-muted space-y-3 rounded-lg p-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">
                      {method === "revolut" ? copy.revtag : copy.weroIdentifier}
                    </dt>
                    <dd className="font-semibold break-all select-all">{recipient}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{copy.amount}</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatMoney(order.totalAmount, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{tracking.orderReference}</dt>
                    <dd className="font-semibold select-all">{reference}</dd>
                  </div>
                </dl>
                <CopyPaymentRecipient recipient={recipient} dict={copy} />
                <ImportantNote testId="confirmation-payment-reference">
                  {copy.paymentReference.replace("{reference}", reference)}
                </ImportantNote>
              </>
            ) : (
              <p role="alert" className="text-sm">
                {copy.unavailable}
              </p>
            )}
            <p
              data-testid="confirmation-payment-disclaimer"
              className="text-muted-foreground pt-2 text-xs italic"
            >
              {copy.paymentDisclaimer}
            </p>
            {instructions && <p className="text-sm whitespace-pre-line">{instructions}</p>}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{copy.noPaymentNeeded}</p>
        )}
      </section>
      <nav className="space-y-2" aria-label={copy.nextSteps}>
        <Button asChild className="min-h-11 w-full">
          <Link
            href={`/${locale}/order/${encodeURIComponent(token)}`}
            data-testid="confirmation-track-link"
          >
            {dict.storefront.trackOrder}
          </Link>
        </Button>
        <Button asChild variant="ghost" className="min-h-11 w-full">
          <Link href={`/${locale}`} data-testid="confirmation-menu-link">
            {tracking.backToCatalog}
          </Link>
        </Button>
      </nav>
    </div>
  );
}

function ImportantNote({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <p
      data-testid={testId}
      className="border-primary/30 bg-primary/10 text-foreground flex items-start gap-2 rounded-lg border p-3 text-sm font-semibold"
    >
      <AlertCircle className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
