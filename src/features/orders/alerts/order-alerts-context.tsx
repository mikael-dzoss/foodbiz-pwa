"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { formatMoney } from "@/domain";
import { createClient } from "@/lib/supabase/client";
import {
  isValidUuid,
  subscribeToOrderInserts,
  type OrderInsertSubscription,
  type RealtimeOrderClient,
} from "@/lib/supabase/realtime";
import { listOrdersAction } from "../order-actions";
import type { EnrichedOrder } from "../order-data";
import { playOrderChime } from "./sound-chime";
import { useManagerLocale } from "@/components/i18n";
import { interpolate } from "@/domain/i18n";

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
  supabaseClient?: RealtimeOrderClient | null;
  subscribeFn?: typeof subscribeToOrderInserts;
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
  businessId,
  supabaseClient,
  subscribeFn = subscribeToOrderInserts,
  initialSoundAlerts = true,
  pollIntervalMs = 15000,
  initialNewCount = 0,
}: OrderAlertsProviderProps) {
  const router = useRouter();
  const { showToast } = useSafeToast();
  const { locale, dict } = useManagerLocale();
  const alertsText = dict.orders.alerts;
  const [newOrdersCount, setNewOrdersCount] = React.useState(initialNewCount);
  const [soundAlerts, setSoundAlerts] = React.useState(initialSoundAlerts);
  const [isConnected, setIsConnected] = React.useState(false);

  // Track known order IDs to avoid duplicate alerts
  const seenOrderIdsRef = React.useRef<Set<string>>(new Set());
  const isInitialLoadRef = React.useRef(true);
  const inFlightCheckRef = React.useRef<Promise<void> | null>(null);

  const clearNewOrdersBadge = React.useCallback(() => {
    setNewOrdersCount(0);
  }, []);

  const handleNewOrderArrival = React.useCallback(
    (order: EnrichedOrder) => {
      // 1. Toast notification with action
      const orderRef = order.orderNumber ? `#${order.orderNumber}` : "";
      const totalText = order.totalAmount ? ` (${formatMoney(order.totalAmount, locale)})` : "";
      const guestText = order.guestName
        ? ` ${interpolate(alertsText.from, { name: order.guestName })}`
        : "";

      showToast(`${alertsText.newOrder} ${orderRef}${guestText}${totalText}`, 6000, {
        label: alertsText.view,
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
    [showToast, soundAlerts, router, clearNewOrdersBadge, locale, alertsText],
  );

  const checkForNewOrders = React.useCallback(async () => {
    if (inFlightCheckRef.current) {
      return inFlightCheckRef.current;
    }

    const checkPromise = (async () => {
      try {
        const res = await listOrdersAction({ statusTab: "active" });
        if (!res.ok) return;

        const newOrders = res.data.orders.filter((o) => o.status === "NEW");

        // On initial mount, populate seen set without firing alerts
        if (isInitialLoadRef.current) {
          for (const o of newOrders) {
            seenOrderIdsRef.current.add(o.id);
          }
          if (initialNewCount === 0) {
            // A transition, so a page boundary still streaming in is hydrated first instead of
            // being client-rendered because the context above it changed.
            React.startTransition(() => setNewOrdersCount(newOrders.length));
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
      } finally {
        inFlightCheckRef.current = null;
      }
    })();

    inFlightCheckRef.current = checkPromise;
    return checkPromise;
  }, [handleNewOrderArrival, initialNewCount]);

  const checkForNewOrdersRef = React.useRef(checkForNewOrders);
  React.useEffect(() => {
    checkForNewOrdersRef.current = checkForNewOrders;
  }, [checkForNewOrders]);

  // Initial check on mount
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      void checkForNewOrdersRef.current();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // Fallback polling interval while realtime is disconnected
  React.useEffect(() => {
    if (isConnected || pollIntervalMs <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      void checkForNewOrdersRef.current();
    }, pollIntervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [isConnected, pollIntervalMs]);

  // Supabase Realtime postgres_changes subscription with exponential backoff & resilience (H6)
  React.useEffect(() => {
    // If no businessId provided or not a valid UUID, realtime cannot connect; fallback polling will handle checks
    if (!businessId || !isValidUuid(businessId)) {
      return;
    }

    let client: RealtimeOrderClient | null | undefined = supabaseClient;
    if (
      client === undefined &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      try {
        client = createClient();
      } catch {
        client = null;
      }
    }

    if (!client) {
      return;
    }

    let isDisposed = false;
    let activeSubscription: OrderInsertSubscription | null = null;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let backoffDelayMs = 1000;

    const setupSubscription = () => {
      if (isDisposed) return;

      if (activeSubscription) {
        void activeSubscription.unsubscribe();
        activeSubscription = null;
      }

      try {
        activeSubscription = subscribeFn(client, businessId, {
          onInsert: (orderId) => {
            // Deduplicate by order id: if already alerted or seen, ignore
            if (orderId && seenOrderIdsRef.current.has(orderId)) return;
            // Realtime event acts as a trigger to fetch full enriched order data
            void checkForNewOrdersRef.current();
          },
          onStatusChange: (status) => {
            if (isDisposed) return;

            if (status === "SUBSCRIBED") {
              setIsConnected(true);
              backoffDelayMs = 1000;
              // Catch-up check to cover any gap during reconnection/connection
              void checkForNewOrdersRef.current();
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              setIsConnected(false);

              // Schedule resubscribe with exponential backoff (1s, 2s, 4s, ..., capped at 30s)
              const delay = backoffDelayMs;
              backoffDelayMs = Math.min(backoffDelayMs * 2, 30000);

              if (retryTimeoutId) {
                clearTimeout(retryTimeoutId);
              }
              retryTimeoutId = setTimeout(() => {
                if (!isDisposed) {
                  setupSubscription();
                }
              }, delay);
            }
          },
        });
      } catch {
        setIsConnected(false);
        const delay = backoffDelayMs;
        backoffDelayMs = Math.min(backoffDelayMs * 2, 30000);
        if (retryTimeoutId) {
          clearTimeout(retryTimeoutId);
        }
        retryTimeoutId = setTimeout(() => {
          if (!isDisposed) {
            setupSubscription();
          }
        }, delay);
      }
    };

    setupSubscription();

    return () => {
      isDisposed = true;
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
      if (activeSubscription) {
        void activeSubscription.unsubscribe();
        activeSubscription = null;
      }
      setIsConnected(false);
    };
  }, [businessId, subscribeFn, supabaseClient]);

  // Manual trigger for testing/simulation
  const triggerMockNewOrder = React.useCallback(
    (customOrder?: Partial<EnrichedOrder>) => {
      const mockNew: EnrichedOrder = {
        id: customOrder?.id ?? `mock-${Date.now()}`,
        businessId: customOrder?.businessId ?? businessId ?? "00000000-0000-0000-0000-000000000000",
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

  // Stable unless a field changes: connection-state re-renders must not change the context value
  // above page Suspense boundaries.
  const value = React.useMemo(
    () => ({
      newOrdersCount,
      soundAlerts,
      setSoundAlerts,
      clearNewOrdersBadge,
      checkForNewOrders,
      triggerMockNewOrder,
    }),
    [newOrdersCount, soundAlerts, clearNewOrdersBadge, checkForNewOrders, triggerMockNewOrder],
  );

  return <OrderAlertsContext.Provider value={value}>{children}</OrderAlertsContext.Provider>;
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
