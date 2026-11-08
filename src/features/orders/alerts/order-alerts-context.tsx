"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useToast } from "@/components/ui";
import { formatMoney } from "@/domain";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { DEMO_BUSINESS_ID } from "@/lib/repositories/mock/fixtures/business";
import { listOrdersAction, type EnrichedOrder } from "../order-actions";
import { playOrderChime } from "./sound-chime";

export interface OrderAlertsContextValue {
  newOrdersCount: number;
  soundAlerts: boolean;
  setSoundAlerts: (enabled: boolean) => void;
  clearNewOrdersBadge: () => void;
  checkForNewOrders: () => Promise<void>;
  triggerMockNewOrder: (order?: Partial<EnrichedOrder>) => void;
}

const OrderAlertsContext = React.createContext<OrderAlertsContextValue | undefined>(undefined);

export interface OrderAlertsProviderProps {
  children: React.ReactNode;
  businessId?: string;
  supabaseClient?: SupabaseClient<Database> | null;
  initialSoundAlerts?: boolean;
  pollIntervalMs?: number;
  initialNewCount?: number;
}

function useSafeToast() {
  try {
    return useToast();
  } catch {
    return {
      showToast: () => {},
    };
  }
}

export function OrderAlertsProvider({
  children,
  businessId = DEMO_BUSINESS_ID,
  supabaseClient,
  initialSoundAlerts = true,
  pollIntervalMs = 0,
  initialNewCount = 0,
}: OrderAlertsProviderProps) {
  const router = useRouter();
  const { showToast } = useSafeToast();
  const [newOrdersCount, setNewOrdersCount] = React.useState(initialNewCount);
  const [soundAlerts, setSoundAlerts] = React.useState(initialSoundAlerts);

  // Track known order IDs to avoid duplicate alerts
  const seenOrderIdsRef = React.useRef<Set<string>>(new Set());
  const isInitialLoadRef = React.useRef(true);

  const clearNewOrdersBadge = React.useCallback(() => {
    setNewOrdersCount(0);
  }, []);

  const handleNewOrderArrival = React.useCallback(
    (order: EnrichedOrder) => {
      // 1. Toast notification with action
      const orderRef = order.orderNumber ? `#${order.orderNumber}` : "";
      const totalText = order.totalAmount ? ` (${formatMoney(order.totalAmount)})` : "";
      const guestText = order.guestName ? ` from ${order.guestName}` : "";

      showToast(`New Order ${orderRef}${guestText}${totalText}`, 6000, {
        label: "View",
        onClick: () => {
          clearNewOrdersBadge();
          router.push(`/manage/orders/${order.id}`);
        },
      });

      // 2. Audible chime if enabled in settings
      if (soundAlerts) {
        playOrderChime();
      }

      // 3. Increment badge
      setNewOrdersCount((prev) => prev + 1);
    },
    [showToast, soundAlerts, router, clearNewOrdersBadge],
  );

  const checkForNewOrders = React.useCallback(async () => {
    try {
      const res = await listOrdersAction({ statusTab: "active" });
      if (!res.success) return;

      const newOrders = res.data.orders.filter((o) => o.status === "NEW");

      // On initial mount, populate seen set without firing alerts
      if (isInitialLoadRef.current) {
        for (const o of newOrders) {
          seenOrderIdsRef.current.add(o.id);
        }
        if (initialNewCount === 0) {
          setNewOrdersCount(newOrders.length);
        }
        isInitialLoadRef.current = false;
        return;
      }

      // Find any newly arrived NEW order
      for (const order of newOrders) {
        if (!seenOrderIdsRef.current.has(order.id)) {
          seenOrderIdsRef.current.add(order.id);
          handleNewOrderArrival(order);
        }
      }
    } catch {
      // Network/auth error during background poll, retry next tick
    }
  }, [handleNewOrderArrival, initialNewCount]);

  // Initial check on mount + optional polling interval fallback
  React.useEffect(() => {
    // Initial check deferred to next tick to avoid synchronous setState during effect setup
    const timeoutId = setTimeout(() => {
      void checkForNewOrders();
    }, 0);

    if (pollIntervalMs <= 0) {
      return () => {
        clearTimeout(timeoutId);
      };
    }

    const intervalId = setInterval(() => {
      void checkForNewOrders();
    }, pollIntervalMs);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [checkForNewOrders, pollIntervalMs]);

  // Supabase Realtime postgres_changes subscription
  React.useEffect(() => {
    let client: SupabaseClient<Database> | null = null;
    if (supabaseClient !== undefined) {
      client = supabaseClient;
    } else if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      try {
        client = createClient();
      } catch {
        client = null;
      }
    }

    if (!client) return;

    const channel = client
      .channel(`orders:business:${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const row = payload.new as
            Partial<Database["public"]["Tables"]["orders"]["Row"]> | undefined;
          if (!row?.id || row.status !== "NEW") return;
          if (seenOrderIdsRef.current.has(row.id)) return;
          seenOrderIdsRef.current.add(row.id);
          handleNewOrderArrival({
            id: row.id,
            businessId: row.business_id ?? businessId,
            orderNumber: row.order_number ?? undefined,
            guestId: row.guest_id ?? "00000000-0000-4000-8000-000000000000",
            guestName: row.submitted_name ?? "",
            serviceType: row.service_type === "delivery" ? "delivery" : "pickup",
            channel: row.channel ?? "storefront",
            status: "NEW",
            paid: row.paid ?? "unpaid",
            paymentPreference: row.payment_preference ?? "on_handover",
            paymentMethod: row.payment_method ?? null,
            paidAt: row.paid_at ?? null,
            requestedDate: row.requested_date ?? new Date().toISOString().slice(0, 10),
            requestedTime: row.requested_time ? row.requested_time.slice(0, 5) : null,
            items: [],
            totalAmount: row.total_amount ?? 0,
            createdAt: row.created_at ?? new Date().toISOString(),
            updatedAt: row.updated_at ?? new Date().toISOString(),
          });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [businessId, handleNewOrderArrival, supabaseClient]);

  // Manual trigger for testing/simulation
  const triggerMockNewOrder = React.useCallback(
    (customOrder?: Partial<EnrichedOrder>) => {
      const mockNew: EnrichedOrder = {
        id: customOrder?.id ?? `mock-${Date.now()}`,
        businessId: customOrder?.businessId ?? businessId,
        orderNumber: customOrder?.orderNumber ?? 99,
        guestId: customOrder?.guestId ?? "00000000-0000-4000-8000-000000000000",
        guestName: customOrder?.guestName ?? "Web Customer",
        serviceType: customOrder?.serviceType ?? "pickup",
        channel: "storefront",
        status: "NEW",
        paid: customOrder?.paid ?? "unpaid",
        paymentPreference: "on_handover",
        paymentMethod: null,
        paidAt: null,
        requestedDate: "2026-10-17",
        requestedTime: null,
        items: customOrder?.items ?? [],
        totalAmount: customOrder?.totalAmount ?? 1500,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...customOrder,
      };

      seenOrderIdsRef.current.add(mockNew.id);
      handleNewOrderArrival(mockNew);
    },
    [businessId, handleNewOrderArrival],
  );

  return (
    <OrderAlertsContext.Provider
      value={{
        newOrdersCount,
        soundAlerts,
        setSoundAlerts,
        clearNewOrdersBadge,
        checkForNewOrders,
        triggerMockNewOrder,
      }}
    >
      {children}
    </OrderAlertsContext.Provider>
  );
}

export function useOrderAlerts(): OrderAlertsContextValue {
  const ctx = React.useContext(OrderAlertsContext);
  if (!ctx) {
    // Graceful fallback for components rendered outside provider in tests
    return {
      newOrdersCount: 0,
      soundAlerts: true,
      setSoundAlerts: () => {},
      clearNewOrdersBadge: () => {},
      checkForNewOrders: async () => {},
      triggerMockNewOrder: () => {},
    };
  }
  return ctx;
}
