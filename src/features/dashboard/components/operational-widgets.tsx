"use client";

import * as React from "react";
import Link from "next/link";
import { ChefHat, AlertCircle, AlertTriangle, ChevronRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMoney, type OperationalTriage } from "@/domain";
import { cn } from "@/lib/utils";

export interface OperationalWidgetsProps {
  triage: OperationalTriage;
  className?: string;
  labels?: {
    sectionTitle?: string;
    realtimeAlerts?: string;
    toPrepare?: string;
    toPrepareCount?: string;
    viewAllPrepOrders?: string;
    noOrdersToPrepare?: string;
    unpaidOrders?: string;
    unpaidOrdersCount?: string;
    reviewUnpaidOrders?: string;
    noUnpaidOrders?: string;
    lowStockAlert?: string;
    lowStockCount?: string;
    manageInventory?: string;
    allStockHealthy?: string;
    unitsLeft?: string;
  };
}

export function OperationalWidgets({ triage, className, labels }: OperationalWidgetsProps) {
  const { toPrepare, unpaid, lowStock } = triage;

  return (
    <section className={cn("space-y-3.5", className)} data-testid="operational-widgets-section">
      <div className="flex items-center justify-between">
        <h2 className="text-title-sm text-foreground">
          {labels?.sectionTitle ?? "Kitchen & Operations"}
        </h2>
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span className="bg-secondary h-1.5 w-1.5 animate-pulse rounded-full" />
          {labels?.realtimeAlerts ?? "Real-time alerts"}
        </span>
      </div>

      <div className="space-y-3">
        {/* Card A: To Prepare */}
        <Card className="border-border bg-card overflow-hidden" data-testid="widget-to-prepare">
          <div className="border-border/60 flex items-center justify-between border-b p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="bg-warning-soft text-warning-soft-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <ChefHat className="h-4 w-4" />
              </span>
              <span className="text-foreground text-sm font-semibold">
                {labels?.toPrepare ?? "To prepare"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant={toPrepare.count > 0 ? "warning" : "completed"}
                className="tabular-nums"
              >
                {toPrepare.count} {labels?.toPrepareCount ?? "orders"}
              </Badge>
            </div>
          </div>

          {toPrepare.count > 0 ? (
            <>
              <div className="divide-border/40 divide-y">
                {toPrepare.items.map((order) => (
                  <Link
                    key={order.id}
                    href={`/manage/orders/${order.id}`}
                    className="hover:bg-muted/50 active:bg-muted flex items-center justify-between p-3.5 transition-colors"
                    data-testid={`to-prepare-order-${order.id}`}
                  >
                    <div className="flex flex-col pr-2">
                      <span className="text-foreground text-sm font-semibold">
                        {order.orderNumber ? `#${order.orderNumber} · ` : ""}
                        {order.guestName}
                      </span>
                      <span className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                        {order.itemsSummary || `${order.itemCount} items`}
                        {order.requestedTime ? ` · Due at ${order.requestedTime}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={order.status === "PREPARING" ? "preparing" : "confirmed"}
                        className="text-caption"
                      >
                        {order.status === "PREPARING" ? "In prep" : "New"}
                      </Badge>
                      <ChevronRight className="text-muted-foreground h-4 w-4" />
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                href="/manage/orders?tab=active"
                className="border-border/60 text-primary hover:bg-muted/40 flex items-center justify-center border-t p-3 text-center text-xs font-semibold transition-colors"
              >
                {labels?.viewAllPrepOrders ?? "View all prep orders →"}
              </Link>
            </>
          ) : (
            <div className="text-muted-foreground flex items-center gap-2 p-3.5 text-xs">
              <CheckCircle2 className="text-primary h-4 w-4" />
              <span>{labels?.noOrdersToPrepare ?? "No orders to prepare right now"}</span>
            </div>
          )}
        </Card>

        {/* Card B: Unpaid Orders */}
        <Card className="border-border bg-card p-3.5" data-testid="widget-unpaid-orders">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="bg-warning-soft text-warning-soft-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <AlertCircle className="h-4 w-4" />
              </span>
              <span className="text-foreground text-sm font-semibold">
                {labels?.unpaidOrders ?? "Unpaid orders"}
              </span>
            </div>
            <Badge
              variant={unpaid.count > 0 ? "warning" : "completed"}
              className="font-semibold tabular-nums"
            >
              {unpaid.count} {labels?.unpaidOrdersCount ?? "unpaid"} ·{" "}
              {formatMoney(unpaid.totalAmount)}
            </Badge>
          </div>

          {unpaid.count > 0 ? (
            <div className="mt-3 flex items-center justify-between pt-1">
              <span className="text-muted-foreground text-xs">
                {unpaid.count === 1
                  ? "1 order awaiting payment handover"
                  : `${unpaid.count} orders awaiting payment settlement`}
              </span>
              <Link
                href="/manage/orders?unpaid=true"
                className="text-secondary text-xs font-semibold hover:underline"
                data-testid="link-review-unpaid-orders"
              >
                {labels?.reviewUnpaidOrders ?? "Review unpaid orders →"}
              </Link>
            </div>
          ) : (
            <div className="text-muted-foreground mt-2.5 flex items-center gap-2 text-xs">
              <CheckCircle2 className="text-primary h-4 w-4" />
              <span>{labels?.noUnpaidOrders ?? "All orders are paid"}</span>
            </div>
          )}
        </Card>

        {/* Card C: Low Stock Alert */}
        <Card className="border-border bg-card overflow-hidden" data-testid="widget-low-stock">
          <div className="border-border/60 flex items-center justify-between border-b p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="bg-destructive/15 text-destructive flex h-8 w-8 items-center justify-center rounded-lg">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span className="text-foreground text-sm font-semibold">
                {labels?.lowStockAlert ?? "Low stock alert"}
              </span>
            </div>
            <Badge
              variant={lowStock.count > 0 ? "destructive" : "completed"}
              className="font-semibold tabular-nums"
            >
              {lowStock.count} {labels?.lowStockCount ?? "items low in stock"}
            </Badge>
          </div>

          {lowStock.count > 0 ? (
            <>
              <div className="divide-border/40 divide-y">
                {lowStock.items.map((product) => (
                  <Link
                    key={product.id}
                    href={`/manage/products/${product.id}`}
                    className="hover:bg-muted/50 active:bg-muted flex items-center justify-between p-3.5 transition-colors"
                    data-testid={`low-stock-product-${product.id}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-foreground text-sm font-semibold">{product.name}</span>
                      <span className="text-destructive mt-0.5 text-xs font-medium tabular-nums">
                        {product.stock === 0
                          ? "Out of stock"
                          : `Only ${product.stock} ${labels?.unitsLeft ?? "left in kitchen"}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="border-destructive/40 text-destructive text-caption rounded border px-2 py-0.5 font-medium">
                        Restock
                      </span>
                      <ChevronRight className="text-muted-foreground h-4 w-4" />
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                href="/manage/products"
                className="border-border/60 text-primary hover:bg-muted/40 flex items-center justify-center border-t p-3 text-center text-xs font-semibold transition-colors"
              >
                {labels?.manageInventory ?? "Manage inventory →"}
              </Link>
            </>
          ) : (
            <div className="text-muted-foreground flex items-center gap-2 p-3.5 text-xs">
              <CheckCircle2 className="text-primary h-4 w-4" />
              <span>{labels?.allStockHealthy ?? "All inventory is well-stocked"}</span>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
