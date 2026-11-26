import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, MapPin, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BusinessSettings } from "@/domain/business";
import { publicDeliveryAddress, type PublicOrder } from "@/domain/order";
import { resolvePickupDisplay } from "@/domain/pickup-location";
import type { Dictionary, SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting";
import { CopyPaymentRecipient } from "./copy-payment-recipient";

export function OrderConfirmationView({
  order,
  settings,
  businessName,
  businessAddress,
  token,
  locale,
  dict,
}: {
  order: PublicOrder;
  settings: Pick<
    BusinessSettings,
    | "revolutRevtag"
    | "weroIdentifier"
    | "paymentMethods"
    | "paymentInstructionsEn"
    | "paymentInstructionsFr"
  > | null;
  businessName: string;
  businessAddress?: string | null;
  token: string;
  locale: SupportedLocale;
  dict: Dictionary;
}) {
  const copy = dict.orderConfirmation;
  const tracking = dict.orderTracking;
  const reference = `#${order.orderNumber ?? "—"}`;
  const method = order.paymentPreference;
  const recipient = method === "revolut" ? settings?.revolutRevtag : settings?.weroIdentifier;
  const cashAllowed = settings?.paymentMethods?.cash ?? true;
  const cardAllowed = settings?.paymentMethods?.card ?? false;
  const handoverCopy =
    cashAllowed && cardAllowed
      ? copy.handoverCashCard
      : cardAllowed
        ? copy.handoverCard
        : copy.handoverCash;
  const handoverPrepareCopy = cashAllowed ? copy.handoverPrepare : copy.handoverPrepareCard;
  const instructions =
    locale === "fr" ? settings?.paymentInstructionsFr : settings?.paymentInstructionsEn;
  const needsPayment = order.paid === "unpaid" && order.status !== "CANCELLED";
  const deliveryAddress = publicDeliveryAddress(order.serviceType, order.deliveryAddress);
  const pickupDisplay = resolvePickupDisplay(
    order.serviceType,
    order.pickupLocation,
    { name: businessName, address: businessAddress },
    businessName,
  );
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
        <h1 className="text-title-lg">{copy.title}</h1>
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
        <h2 id="confirmation-summary" className="text-title-sm">
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

      {deliveryAddress && (
        <section
          className="border-border bg-card space-y-3 rounded-lg border p-4"
          aria-labelledby="confirmation-delivery-title"
          data-testid="confirmation-delivery-address"
        >
          <h2 id="confirmation-delivery-title" className="text-title-sm flex items-center gap-1.5">
            <Truck className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{tracking.fulfillmentDetails}</span>
          </h2>
          <dl>
            <dt className="text-muted-foreground text-xs font-medium">{tracking.deliveryTo}</dt>
            <dd className="text-foreground mt-0.5 text-xs font-semibold wrap-break-word">
              {deliveryAddress}
            </dd>
          </dl>
        </section>
      )}

      {pickupDisplay && (
        <section
          className="border-border bg-card space-y-3 rounded-lg border p-4"
          aria-labelledby="confirmation-pickup-title"
          data-testid="confirmation-pickup-location"
        >
          <h2 id="confirmation-pickup-title" className="text-title-sm flex items-center gap-1.5">
            <Store className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{tracking.fulfillmentDetails}</span>
          </h2>
          <div className="flex items-start justify-between gap-3">
            <dl className="min-w-0 flex-1">
              <dt className="text-muted-foreground text-xs font-medium">{tracking.collectAt}</dt>
              <dd
                className="text-foreground mt-0.5 text-xs font-bold wrap-break-word"
                data-testid="confirmation-pickup-name"
              >
                {pickupDisplay.name}
              </dd>
              {pickupDisplay.address && (
                <dd
                  className="text-muted-foreground mt-0.5 text-xs wrap-break-word"
                  data-testid="confirmation-pickup-address"
                >
                  {pickupDisplay.address}
                </dd>
              )}
            </dl>
            {pickupDisplay.directionsUrl && (
              <a
                href={pickupDisplay.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="confirmation-directions-link"
                className="border-border hover:bg-muted text-primary inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors active:opacity-80"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{tracking.directions}</span>
              </a>
            )}
          </div>
        </section>
      )}

      <section
        className="border-border bg-card space-y-3 rounded-lg border p-4"
        aria-labelledby="confirmation-payment-title"
        data-testid="confirmation-payment"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="confirmation-payment-title" className="text-title-sm">
            {copy.paymentTitle}
          </h2>
          <Badge variant={order.paid === "paid" ? "paid" : "unpaid"}>{paymentStatus}</Badge>
        </div>
        {needsPayment ? (
          <>
            {method === "on_handover" ? (
              <>
                <p className="text-sm">{handoverCopy}</p>
                <ImportantNote testId="confirmation-handover-prepare">
                  {handoverPrepareCopy}
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
