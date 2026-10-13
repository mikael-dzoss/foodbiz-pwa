"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Clock,
  Phone,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatMoney } from "@/domain";
import type { ListOrdersResult } from "../order-actions";
import { cn } from "@/lib/utils";

export interface OrderListProps {
  initialData: ListOrdersResult;
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

export function OrderList({ initialData }: OrderListProps) {
  const [activeTab, setActiveTab] = React.useState<"active" | "completed" | "cancelled">("active");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [unpaidOnly, setUnpaidOnly] = React.useState(false);
  const [selectedServiceType, setSelectedServiceType] = React.useState<string>("all");

  const orders = initialData.orders;

  // Filter client-side for immediate responsiveness
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

      // 3. Service type filter
      if (selectedServiceType !== "all" && order.serviceType !== selectedServiceType) {
        return false;
      }

      // 4. Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.trim().toLowerCase();
        const numStr = order.orderNumber ? String(order.orderNumber) : "";
        const matchesRef = numStr === q || `#${numStr}` === q || numStr.includes(q);
        const matchesName = order.guestName.toLowerCase().includes(q);
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

  // Counts based on initial data
  const counts = initialData.counts;

  return (
    <div className="flex flex-col gap-4 pb-24" data-testid="orders-list-screen">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-display-sm text-foreground font-bold">Orders</h1>
          <p className="text-body-sm text-muted-foreground">
            Manage incoming orders and delivery fulfillment
          </p>
        </div>
        <Link href="/manage/orders/new">
          <Button
            type="button"
            className="bg-primary text-primary-foreground min-h-11 shadow-sm"
            data-testid="create-order-button"
          >
            <Plus className="mr-1.5 h-4 w-4 stroke-[2.5]" />
            New order
          </Button>
        </Link>
      </div>

      {/* Segmented Status Tabs */}
      <div
        className="border-border bg-muted/60 grid grid-cols-3 rounded-xl border p-1"
        role="tablist"
        aria-label="Order Status Tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "active"}
          onClick={() => setActiveTab("active")}
          className={cn(
            "flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all",
            activeTab === "active"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          data-testid="tab-active"
        >
          <span>Active</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              activeTab === "active"
                ? "bg-primary-soft text-primary-soft-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {counts.active}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "completed"}
          onClick={() => setActiveTab("completed")}
          className={cn(
            "flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all",
            activeTab === "completed"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          data-testid="tab-completed"
        >
          <span>Completed</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              activeTab === "completed"
                ? "bg-primary-soft text-primary-soft-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {counts.completed}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "cancelled"}
          onClick={() => setActiveTab("cancelled")}
          className={cn(
            "flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all",
            activeTab === "cancelled"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          data-testid="tab-cancelled"
        >
          <span>Cancelled</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              activeTab === "cancelled"
                ? "bg-muted text-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {counts.cancelled}
          </span>
        </button>
      </div>

      {/* Search Input & Quick Filters */}
      <div className="flex flex-col gap-2.5">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or order reference..."
            className="border-input bg-card h-12 pr-10 pl-10 text-base"
            data-testid="order-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 p-1"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Chips Horizontal Row */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={unpaidOnly ? "default" : "outline"}
            onClick={() => setUnpaidOnly(!unpaidOnly)}
            className={cn(
              "min-h-9 rounded-full text-xs font-semibold",
              unpaidOnly && "bg-warning-soft text-warning-soft-foreground hover:bg-warning-soft/90",
            )}
            data-testid="filter-unpaid"
          >
            <AlertCircle className="mr-1 h-3.5 w-3.5" />
            Unpaid only ({counts.unpaid})
          </Button>

          <Button
            type="button"
            size="sm"
            variant={selectedServiceType === "all" ? "secondary" : "outline"}
            onClick={() => setSelectedServiceType("all")}
            className="min-h-9 rounded-full text-xs font-medium"
            data-testid="filter-service-all"
          >
            All services
          </Button>

          <Button
            type="button"
            size="sm"
            variant={selectedServiceType === "pickup" ? "secondary" : "outline"}
            onClick={() =>
              setSelectedServiceType(selectedServiceType === "pickup" ? "all" : "pickup")
            }
            className="min-h-9 rounded-full text-xs font-medium"
            data-testid="filter-service-pickup"
          >
            Pickup
          </Button>

          <Button
            type="button"
            size="sm"
            variant={selectedServiceType === "delivery" ? "secondary" : "outline"}
            onClick={() =>
              setSelectedServiceType(selectedServiceType === "delivery" ? "all" : "delivery")
            }
            className="min-h-9 rounded-full text-xs font-medium"
            data-testid="filter-service-delivery"
          >
            Delivery
          </Button>

          <Button
            type="button"
            size="sm"
            variant={selectedServiceType === "dine-in" ? "secondary" : "outline"}
            onClick={() =>
              setSelectedServiceType(selectedServiceType === "dine-in" ? "all" : "dine-in")
            }
            className="min-h-9 rounded-full text-xs font-medium"
            data-testid="filter-service-dine-in"
          >
            Dine-in
          </Button>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="No orders found"
          description={
            searchQuery || unpaidOnly || selectedServiceType !== "all"
              ? "Try adjusting your filters or search terms."
              : `No ${activeTab} orders at the moment.`
          }
          action={{
            label: "Clear filters",
            onClick: () => {
              setSearchQuery("");
              setUnpaidOnly(false);
              setSelectedServiceType("all");
            },
          }}
          data-testid="orders-empty-state"
        />
      ) : (
        <div className="flex flex-col gap-3" data-testid="orders-list">
          {filteredOrders.map((order) => {
            const isNew = order.status === "NEW";
            const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);
            const itemsSummary = order.items
              .slice(0, 2)
              .map((it) => `${it.quantity}x ${it.productName}`)
              .join(", ");
            const hasMoreItems = order.items.length > 2;

            return (
              <Link
                key={order.id}
                href={`/manage/orders/${order.id}`}
                className={cn(
                  "border-border bg-card hover:border-primary/50 focus-visible:ring-primary relative flex flex-col gap-2.5 rounded-xl border p-4 transition-all focus-visible:ring-2 focus-visible:outline-none",
                  isNew && "border-info/60 ring-info/30 bg-info/5 ring-2",
                )}
                data-testid={`order-card-${order.id}`}
              >
                {/* Header row: Order #, Status, Timing badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-base font-bold tabular-nums">
                      #{order.orderNumber ?? "—"}
                    </span>
                    <Badge variant={STATUS_BADGE_MAP[order.status] ?? "default"}>
                      {order.status}
                    </Badge>
                  </div>

                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium">
                      {order.requestedTime
                        ? `${order.serviceType === "pickup" ? "Pickup" : "Delivery"} at ${order.requestedTime}`
                        : `${order.serviceType === "pickup" ? "Pickup" : "Delivery"} ASAP`}
                    </span>
                  </div>
                </div>

                {/* Guest details row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-foreground text-sm font-semibold">{order.guestName}</span>
                    {order.guestPhone && (
                      <span className="text-body-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {order.guestPhone}
                      </span>
                    )}
                  </div>
                  <span className="text-body-sm text-muted-foreground capitalize">
                    {order.serviceType}
                  </span>
                </div>

                {/* Items summary */}
                <div className="bg-muted/40 text-muted-foreground rounded-lg p-2 text-xs">
                  <span className="text-foreground mr-1.5 font-medium">
                    {itemCount} {itemCount === 1 ? "item" : "items"}:
                  </span>
                  <span>
                    {itemsSummary}
                    {hasMoreItems ? "..." : ""}
                  </span>
                </div>

                {/* Footer row: Total and Payment status badge */}
                <div className="border-border flex items-center justify-between border-t pt-2.5">
                  <div className="flex items-center gap-2">
                    {order.paid === "paid" ? (
                      <Badge variant="paid" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid
                      </Badge>
                    ) : (
                      <Badge variant="unpaid" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Unpaid
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-xs uppercase">
                      {order.paymentPreference.replace("_", " ")}
                    </span>
                  </div>

                  <span className="text-foreground text-base font-bold tabular-nums">
                    {formatMoney(order.totalAmount)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
