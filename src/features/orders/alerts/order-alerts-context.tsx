"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { formatMoney } from "@/domain";
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
  initialSoundAlerts = true,
  pollIntervalMs = 10000,
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
        setNewOrdersCount(newOrders.length);
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
  }, [handleNewOrderArrival]);

  // Polling loop
  React.useEffect(() => {
    if (pollIntervalMs <= 0) return;

    // Initial check deferred to next tick to avoid synchronous setState during effect setup
    const timeoutId = setTimeout(() => {
      void checkForNewOrders();
    }, 0);

    const intervalId = setInterval(() => {
      void checkForNewOrders();
    }, pollIntervalMs);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [checkForNewOrders, pollIntervalMs]);

  // Manual trigger for testing/simulation
  const triggerMockNewOrder = React.useCallback(
    (customOrder?: Partial<EnrichedOrder>) => {
      const mockNew: EnrichedOrder = {
        id: customOrder?.id ?? `mock-${Date.now()}`,
        businessId: customOrder?.businessId ?? "biz-1",
        orderNumber: customOrder?.orderNumber ?? 99,
        guestId: null,
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
    [handleNewOrderArrival],
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
