"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Clock,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  ChefHat,
  PackageCheck,
  Check,
  Store,
  MapPin,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatMoney, getZonedDay, getZonedMinutesOfDay, type OrderStatus } from "@/domain";
import { useBusinessTimeZone } from "@/components/time/business-timezone";
import { progressOrderStatusAction } from "../order-actions";
import type { EnrichedOrder, ListOrdersResult } from "../order-data";
import { cn } from "@/lib/utils";
import { useManagerLocale } from "@/components/i18n";
import { interpolate, type OrdersDictionary } from "@/domain/i18n";

export interface OrderListProps {
  initialData: ListOrdersResult;
  initialTab?: "active" | "completed" | "cancelled";
  initialUnpaidOnly?: boolean;
  /** The server's current instant (ISO), so render and hydration agree on "now". */
  now: string;
  onFilterChange?: (filter: {
    tab: "active" | "completed" | "cancelled";
    serviceType?: string;
    unpaidOnly?: boolean;
    search?: string;
  }) => void;
}

const STATUS_BADGE_MAP: Record<string, NonNullable<BadgeProps["variant"]>> = {
  NEW: "new",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

interface NextActionStep {
  status: "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  buttonClass: string;
}

function getNextAction(order: EnrichedOrder, t: OrdersDictionary): NextActionStep | null {
  const commonButtonClass =
    "border border-primary/30 bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/80";

  switch (order.status) {
    case "NEW":
      return {
        status: "CONFIRMED",
        label: t.nextAction.accept,
        icon: CheckCircle2,
        buttonClass: commonButtonClass,
      };
    case "CONFIRMED":
      return {
        status: "PREPARING",
        label: t.nextAction.startPreparing,
        icon: ChefHat,
        buttonClass: commonButtonClass,
      };
    case "PREPARING":
      return {
        status: "READY",
        label: t.nextAction.markReady,
        icon: PackageCheck,
        buttonClass: commonButtonClass,
      };
    case "READY":
      return {
        status: "COMPLETED",
        label: order.paid !== "paid" ? t.nextAction.payAndComplete : t.nextAction.completeOrder,
        icon: Check,
        buttonClass: commonButtonClass,
      };
    default:
      return null;
  }
}

/** How far a requested date/time is from `now`, read on the business calendar in `timeZone`. */
function getDueTimeDiff(
  requestedDate: string | null | undefined,
  requestedTime: string | null | undefined,
  now: Date,
  timeZone: string,
  t: OrdersDictionary,
) {
  if (!requestedDate) return null;
  const [y, m, d] = requestedDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const [ty, tm, td] = getZonedDay(now, timeZone).split("-").map(Number);

  const diffDays = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);

  if (diffDays > 0) {
    return { text: interpolate(t.daysAhead, { days: diffDays }), isOverdue: false };
  } else if (diffDays === 0) {
    if (requestedTime) {
      const [dueH, dueM] = requestedTime.split(":").map(Number);
      if (dueH * 60 + dueM < getZonedMinutesOfDay(now, timeZone)) {
        return { text: t.overdue, isOverdue: true };
      }
    }
    return null;
  } else {
    return { text: interpolate(t.daysLate, { days: Math.abs(diffDays) }), isOverdue: true };
  }
}

export function OrderList({
  initialData,
  initialTab = "active",
  initialUnpaidOnly = false,
  now,
}: OrderListProps) {
  const timeZone = useBusinessTimeZone();
  const router = useRouter();
  const { locale, dict } = useManagerLocale();
  const t = dict.orders;
  const [localStatusUpdates, setLocalStatusUpdates] = React.useState<Record<string, OrderStatus>>(
    {},
  );
  const [activeTab, setActiveTab] = React.useState<"active" | "completed" | "cancelled">(
    initialTab,
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [unpaidOnly, setUnpaidOnly] = React.useState(initialUnpaidOnly);
  const [selectedServiceType, setSelectedServiceType] = React.useState<
    "all" | "pickup" | "delivery"
  >("all");
  const [transitioningId, setTransitioningId] = React.useState<string | null>(null);

  // Derive orders with any local quick transitions
  const orders = React.useMemo(() => {
    return initialData.orders.map((o) => {
      const updated = localStatusUpdates[o.id];
      return updated ? { ...o, status: updated } : o;
    });
  }, [initialData.orders, localStatusUpdates]);

  // Orders belonging to the currently selected lifecycle tab
  const currentTabOrders = React.useMemo(() => {
    return orders.filter((o) => {
      if (activeTab === "active") {
        return ["NEW", "CONFIRMED", "PREPARING", "READY"].includes(o.status);
      } else if (activeTab === "completed") {
        return o.status === "COMPLETED";
      } else {
        return o.status === "CANCELLED";
      }
    });
  }, [orders, activeTab]);

  // Dynamic live counts: tab totals for segmented header, sub-counts scoped to current tab
  const liveCounts = React.useMemo(() => {
    return {
      active: orders.filter((o) => ["NEW", "CONFIRMED", "PREPARING", "READY"].includes(o.status))
        .length,
      completed: orders.filter((o) => o.status === "COMPLETED").length,
      cancelled: orders.filter((o) => o.status === "CANCELLED").length,
      unpaid: currentTabOrders.filter((o) => o.paid === "unpaid").length,
      pickup: currentTabOrders.filter((o) => o.serviceType === "pickup").length,
      delivery: currentTabOrders.filter((o) => o.serviceType === "delivery").length,
    };
  }, [orders, currentTabOrders]);

  // Reactive client-side filtering for immediate responsiveness
  const filteredOrders = React.useMemo(() => {
    return orders.filter((order) => {
      // 1. Tab filter
      if (activeTab === "active") {
        if (!["NEW", "CONFIRMED", "PREPARING", "READY"].includes(order.status)) return false;
      } else if (activeTab === "completed") {
        if (order.status !== "COMPLETED") return false;
      } else if (activeTab === "cancelled") {
        if (order.status !== "CANCELLED") return false;
      }

      // 2. Unpaid filter
      if (unpaidOnly && order.paid !== "unpaid") {
        return false;
      }

      // 3. Service type filter (only pickup and delivery supported)
      if (selectedServiceType !== "all" && order.serviceType !== selectedServiceType) {
        return false;
      }

      // 4. Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.trim().toLowerCase();
        const numStr = order.orderNumber ? String(order.orderNumber) : "";
        const matchesRef = numStr === q || `#${numStr}` === q || numStr.includes(q);
        const matchesName =
          order.guestName.toLowerCase().includes(q) ||
          Boolean(order.submittedName && order.submittedName.toLowerCase().includes(q));
        const matchesPhone = order.guestPhone ? order.guestPhone.toLowerCase().includes(q) : false;
        const matchesToken = order.trackingToken
          ? order.trackingToken.toLowerCase().includes(q)
          : false;

        if (!matchesRef && !matchesName && !matchesPhone && !matchesToken) {
          return false;
        }
      }

      return true;
    });
  }, [orders, activeTab, unpaidOnly, selectedServiceType, searchQuery]);

  const handleQuickProgress = async (e: React.MouseEvent, order: EnrichedOrder) => {
    e.preventDefault();
    e.stopPropagation();

    const next = getNextAction(order, t);
    if (!next) return;

    if (next.status === "COMPLETED" && order.paid !== "paid") {
      router.push(`/manage/orders/${order.id}`);
      return;
    }

    setTransitioningId(order.id);
    try {
      const res = await progressOrderStatusAction({
        orderId: order.id,
        nextStatus: next.status,
      });

      if (res.ok) {
        setLocalStatusUpdates((prev) => ({
          ...prev,
          [order.id]: next.status,
        }));
      }
    } finally {
      setTransitioningId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 pb-24" data-testid="orders-list-screen">
      {/* Top Header: Matching Stitch M-20 */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <h1 className="text-title-lg text-foreground min-w-0">{t.title}</h1>

        {/* Single-line New Order action button */}
        <Button
          asChild
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 gap-1 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shadow-none"
        >
          <Link href="/manage/orders/new" data-testid="create-order-button">
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{t.newOrder}</span>
          </Link>
        </Button>
      </div>

      {/* Segmented Status Tabs (3 columns matching Stitch M-20) */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
        className="flex flex-col gap-3.5"
      >
        <TabsList
          aria-label={t.statusTabsLabel}
          className="bg-muted/80 grid h-auto w-full grid-cols-3 gap-1 rounded-xl p-1 text-center text-xs"
        >
          <TabsTrigger
            value="active"
            className="text-muted-foreground hover:text-foreground data-[state=active]:bg-primary-soft data-[state=active]:text-primary-soft-foreground min-h-9 gap-1 rounded-lg px-0 py-2 text-xs font-medium data-[state=active]:font-bold data-[state=active]:shadow-xs"
            data-testid="tab-active"
          >
            <span>{t.tabs.active}</span>
            <span className="bg-card text-primary-soft-foreground text-micro inline-flex items-center justify-center rounded-full px-1.5 font-bold tabular-nums">
              {liveCounts.active}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="completed"
            className="text-muted-foreground hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground min-h-9 gap-1 rounded-lg px-0 py-2 text-xs font-medium data-[state=active]:font-semibold data-[state=active]:shadow-xs"
            data-testid="tab-completed"
          >
            <span>{t.tabs.completed}</span>
            <span className="text-muted-foreground text-micro tabular-nums">
              ({liveCounts.completed})
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="cancelled"
            className="text-muted-foreground hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground min-h-9 gap-1 rounded-lg px-0 py-2 text-xs font-medium data-[state=active]:font-semibold data-[state=active]:shadow-xs"
            data-testid="tab-cancelled"
          >
            <span>{t.tabs.cancelled}</span>
            <span className="text-muted-foreground text-micro tabular-nums">
              ({liveCounts.cancelled})
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Search & Filters Section */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="border-input bg-card h-11 rounded-xl pr-9 pl-10"
              data-testid="order-search-input"
            />
            {searchQuery && (
              <Button
                variant="unstyled"
                size="none"
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 p-1"
                aria-label={t.clearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Filter Chips Horizontal Row (Only All, Unpaid, Pickup, Delivery) */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <Button
              type="button"
              size="sm"
              variant={selectedServiceType === "all" && !unpaidOnly ? "default" : "outline"}
              onClick={() => {
                setSelectedServiceType("all");
                setUnpaidOnly(false);
              }}
              className="h-9 min-h-9 rounded-full px-3 text-xs font-semibold whitespace-nowrap"
              data-testid="filter-service-all"
            >
              {t.filters.all}
            </Button>

            <Button
              type="button"
              size="sm"
              variant={unpaidOnly ? "default" : "outline"}
              onClick={() => setUnpaidOnly(!unpaidOnly)}
              className={cn(
                "flex h-9 min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap",
                unpaidOnly && "bg-destructive text-destructive-foreground",
              )}
              data-testid="filter-unpaid"
            >
              <span className="bg-destructive h-1.5 w-1.5 rounded-full" />
              {interpolate(t.filters.unpaidOnly, { count: liveCounts.unpaid })}
            </Button>

            <Button
              type="button"
              size="sm"
              variant={selectedServiceType === "pickup" ? "default" : "outline"}
              onClick={() =>
                setSelectedServiceType(selectedServiceType === "pickup" ? "all" : "pickup")
              }
              className="h-9 min-h-9 rounded-full px-3 text-xs font-medium whitespace-nowrap"
              data-testid="filter-service-pickup"
            >
              {interpolate(t.filters.pickup, { count: liveCounts.pickup })}
            </Button>

            <Button
              type="button"
              size="sm"
              variant={selectedServiceType === "delivery" ? "default" : "outline"}
              onClick={() =>
                setSelectedServiceType(selectedServiceType === "delivery" ? "all" : "delivery")
              }
              className="h-9 min-h-9 rounded-full px-3 text-xs font-medium whitespace-nowrap"
              data-testid="filter-service-delivery"
            >
              {interpolate(t.filters.delivery, { count: liveCounts.delivery })}
            </Button>
          </div>
        </div>

        {/* Orders Triage Stream */}
        <TabsContent value={activeTab} className="mt-0">
          {filteredOrders.length === 0 ? (
            <EmptyState
              headingLevel={2}
              icon={<ShoppingBag className="h-6 w-6" />}
              title={t.empty.title}
              description={
                searchQuery || unpaidOnly || selectedServiceType !== "all"
                  ? t.empty.filtered
                  : t.empty[activeTab]
              }
              action={{
                label: t.empty.clearFilters,
                onClick: () => {
                  setSearchQuery("");
                  setUnpaidOnly(false);
                  setSelectedServiceType("all");
                },
              }}
              data-testid="orders-empty-state"
            />
          ) : (
            <section
              aria-label={t.listLabel}
              className="flex flex-col gap-3"
              data-testid="orders-list"
            >
              {filteredOrders.map((order) => {
                const isNew = order.status === "NEW";
                const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);
                const itemsSummary = order.items
                  .slice(0, 2)
                  .map((it) => `${it.quantity}× ${it.productName}`)
                  .join(", ");
                const hasMoreItems = order.items.length > 2;
                const nextAction = getNextAction(order, t);
                const dueDiff =
                  activeTab === "active"
                    ? getDueTimeDiff(
                        order.requestedDate,
                        order.requestedTime,
                        new Date(now),
                        timeZone,
                        t,
                      )
                    : null;

                return (
                  <article
                    key={order.id}
                    className={cn(
                      "bg-card border-border relative space-y-2.5 rounded-xl border p-3.5 shadow-none transition-all",
                      isNew && "border-info border-2",
                    )}
                    data-testid={`order-card-${order.id}`}
                  >
                    {/* Top Row: ID, Status Badge, Timing pill */}
                    <div className="border-border/60 flex items-center justify-between gap-2 border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground text-sm font-bold tabular-nums">
                          #{order.orderNumber ?? "—"}
                        </span>
                        <Badge
                          variant={STATUS_BADGE_MAP[order.status] ?? "default"}
                          className="uppercase"
                        >
                          {t.status[order.status]}
                        </Badge>
                      </div>

                      <div className="text-foreground flex items-center gap-1 text-xs font-semibold">
                        <Clock className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="tabular-nums">
                          {order.requestedTime
                            ? interpolate(
                                order.serviceType === "pickup" ? t.pickupAt : t.deliveryAt,
                                { time: order.requestedTime },
                              )
                            : order.serviceType === "pickup"
                              ? t.pickupAsap
                              : t.deliveryAsap}
                        </span>
                        {dueDiff && (
                          <span
                            className={cn(
                              "ml-1 font-bold",
                              dueDiff.isOverdue ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {dueDiff.text}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Guest & Contact row with dedicated Eye button */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="text-foreground shrink-0 text-sm font-semibold">
                            {order.guestName}
                          </span>
                          {order.guestPhone && (
                            <>
                              <span className="text-muted-foreground/60 shrink-0 text-xs">•</span>
                              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                                {order.guestPhone}
                              </span>
                            </>
                          )}
                          {order.submittedName && order.submittedName !== order.guestName && (
                            <>
                              <span className="text-muted-foreground/60 shrink-0 text-xs">•</span>
                              <span
                                data-testid="order-submitted-name-badge"
                                title={interpolate(t.orderedAs, { name: order.submittedName })}
                                className="bg-warning-soft text-warning-soft-foreground border-warning/30 text-caption min-w-0 truncate rounded border px-1.5 py-0.5 font-medium"
                              >
                                {interpolate(t.orderedAs, { name: order.submittedName })}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
                          {order.serviceType === "delivery" ? (
                            <>
                              <MapPin
                                className="text-muted-foreground h-3 w-3 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 truncate">
                                {order.deliveryAddress ?? t.addressPending}
                              </span>
                            </>
                          ) : order.pickupLocation ? (
                            <>
                              <MapPin
                                className="text-muted-foreground h-3 w-3 shrink-0"
                                aria-hidden="true"
                              />
                              <span
                                className="min-w-0 truncate"
                                title={order.pickupLocation.name}
                                data-testid="order-pickup-location"
                              >
                                {order.pickupLocation.name}
                              </span>
                            </>
                          ) : (
                            <>
                              <Store
                                className="text-muted-foreground h-3 w-3 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 truncate">{t.storePickup}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Dedicated Eye button mapping to details view */}
                      <Link
                        href={`/manage/orders/${order.id}`}
                        aria-label={interpolate(t.viewDetails, { number: order.orderNumber ?? "" })}
                        className="bg-muted hover:bg-border text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors active:scale-95"
                        data-testid={`view-order-${order.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </div>

                    {/* Items Ordered Preview Box */}
                    <div className="bg-muted text-foreground rounded-lg px-2.5 py-1.5 text-xs leading-relaxed">
                      <span className="font-semibold">
                        {interpolate(itemCount === 1 ? t.itemOne : t.itemOther, {
                          count: itemCount,
                        })}
                        :
                      </span>{" "}
                      <span className="text-muted-foreground">{itemsSummary}</span>
                      {hasMoreItems ? "..." : ""}
                    </div>

                    {/* Footer: Financials & Dynamic Next Status Action Button */}
                    <div className="border-border/60 flex items-center justify-between gap-2 border-t pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground text-sm font-bold tabular-nums">
                          {formatMoney(order.totalAmount, locale)}
                        </span>
                        {order.status === "CANCELLED" && order.paid === "paid" ? (
                          <Badge
                            variant="warning"
                            className="text-micro gap-0.5 px-1.5 py-0 font-bold"
                            data-testid="refund-due-badge"
                          >
                            <AlertCircle className="h-2.5 w-2.5" />
                            {t.payment.refundDue}
                          </Badge>
                        ) : order.paid === "paid" ? (
                          <Badge variant="paid" className="text-micro gap-0.5 px-1.5 py-0">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {t.payment.paid}
                          </Badge>
                        ) : order.paid === "refunded" ? (
                          <Badge
                            variant="refunded"
                            className="text-micro gap-0.5 px-1.5 py-0"
                            data-testid="refunded-badge"
                          >
                            {t.payment.refunded}
                          </Badge>
                        ) : (
                          <Badge variant="unpaid" className="text-micro gap-0.5 px-1.5 py-0">
                            <AlertCircle className="h-2.5 w-2.5" />
                            {t.payment.unpaid}
                          </Badge>
                        )}
                      </div>

                      {/* Right bottom button dynamically indicating next valid state */}
                      {nextAction && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleQuickProgress(e, order)}
                          disabled={transitioningId === order.id}
                          className={cn(
                            "inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold shadow-none active:scale-95",
                            nextAction.buttonClass,
                          )}
                          data-testid={`quick-progress-${order.id}`}
                        >
                          <nextAction.icon className="h-3.5 w-3.5" />
                          <span>
                            {transitioningId === order.id
                              ? t.nextAction.updating
                              : nextAction.label}
                          </span>
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
