import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { Database } from "@/lib/supabase/database.types";
import type { RealtimeOrderClient } from "@/lib/supabase/realtime";
import { OrderAlertsProvider, useOrderAlerts } from "../alerts/order-alerts-context";
import * as chimeModule from "../alerts/sound-chime";
import * as actions from "../order-actions";
import type { EnrichedOrder } from "../order-actions";
import { ManagerBottomNav } from "@/features/manager/components/manager-bottom-nav";
import { ManagerSidebar } from "@/features/manager/components/manager-sidebar";
import { getDictionary } from "@/domain/i18n";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
  usePathname: () => "/manage",
}));

const mockShowToast = vi.fn();
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    useToast: () => ({
      showToast: mockShowToast,
    }),
  };
});

const dict = getDictionary("en");

const initialMockOrders: EnrichedOrder[] = [
  {
    id: "ord-old-1",
    businessId: "10000000-0000-0000-0000-000000000001",
    orderNumber: 10,
    guestId: "00000000-0000-4000-8000-000000000001",
    guestName: "Old Customer",
    serviceType: "pickup",
    channel: "storefront",
    status: "CONFIRMED",
    paid: "paid",
    paymentPreference: "on_handover",
    paymentMethod: "cash",
    paidAt: null,
    requestedDate: "2026-10-17",
    requestedTime: null,
    items: [],
    totalAmount: 1000,
    createdAt: "2026-10-17T10:00:00.000Z",
    updatedAt: "2026-10-17T10:00:00.000Z",
  },
];

function TestConsumer() {
  const { newOrdersCount, soundAlerts, setSoundAlerts, clearNewOrdersBadge, triggerMockNewOrder } =
    useOrderAlerts();

  return (
    <div>
      <span data-testid="test-count">{newOrdersCount}</span>
      <span data-testid="test-sound">{soundAlerts ? "on" : "off"}</span>
      <button
        type="button"
        data-testid="btn-toggle-sound"
        onClick={() => setSoundAlerts(!soundAlerts)}
      >
        Toggle sound
      </button>
      <button type="button" data-testid="btn-clear" onClick={clearNewOrdersBadge}>
        Clear
      </button>
      <button
        type="button"
        data-testid="btn-trigger"
        onClick={() =>
          triggerMockNewOrder({
            id: "ord-new-99",
            orderNumber: 99,
            guestName: "Live Customer",
            totalAmount: 1850,
          })
        }
      >
        Simulate Order
      </button>
    </div>
  );
}

type RealtimeCallback = (payload: {
  new?: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
}) => void;
type StatusCallback = (status: string, err?: Error | null) => void;

function createMockSupabaseClient() {
  let registeredCallback: RealtimeCallback | null = null;
  let registeredStatusCallback: StatusCallback | null = null;
  let registeredEvent = "";
  let registeredFilter = {};

  const mockChannel = {
    on: vi.fn((event: string, filter: Record<string, unknown>, callback: RealtimeCallback) => {
      registeredEvent = event;
      registeredFilter = filter;
      registeredCallback = callback;
      return mockChannel;
    }),
    subscribe: vi.fn((statusCb?: StatusCallback) => {
      registeredStatusCallback = statusCb ?? null;
      return mockChannel;
    }),
  };

  const client = {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(() => Promise.resolve("ok")),
  } as unknown as RealtimeOrderClient;

  return {
    client,
    mockChannel,
    getRegisteredCallback: () => registeredCallback,
    getRegisteredStatusCallback: () => registeredStatusCallback,
    triggerStatus: (status: string, err?: Error | null) => registeredStatusCallback?.(status, err),
    getRegisteredEvent: () => registeredEvent,
    getRegisteredFilter: () => registeredFilter,
  };
}

describe("Order Alerts & Notifications (Story #56 & #124)", () => {
  let playChimeSpy: ReturnType<typeof vi.spyOn>;
  let currentOrders: EnrichedOrder[];

  beforeEach(() => {
    vi.clearAllMocks();
    currentOrders = [...initialMockOrders];
    playChimeSpy = vi.spyOn(chimeModule, "playOrderChime").mockImplementation(() => {});

    vi.spyOn(actions, "listOrdersAction").mockImplementation(async () => ({
      success: true,
      data: {
        orders: [...currentOrders],
        counts: {
          active: currentOrders.length,
          completed: 0,
          cancelled: 0,
          total: currentOrders.length,
          unpaid: 0,
          pickup: currentOrders.length,
          delivery: 0,
        },
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("triggers toast notification and plays sound chime when a NEW order arrives with soundAlerts enabled", async () => {
    render(
      <OrderAlertsProvider initialSoundAlerts={true} pollIntervalMs={0}>
        <TestConsumer />
      </OrderAlertsProvider>,
    );

    expect(screen.getByTestId("test-count").textContent).toBe("0");

    // Simulate new order arrival
    act(() => {
      screen.getByTestId("btn-trigger").click();
    });

    // Count incremented
    expect(screen.getByTestId("test-count").textContent).toBe("1");

    // Toast triggered with order details and View action
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast.mock.calls[0][0]).toContain("New Order #99 from Live Customer (€18.50)");
    expect(mockShowToast.mock.calls[0][2]?.label).toBe("View");

    // Sound chime played
    expect(playChimeSpy).toHaveBeenCalledTimes(1);

    // Clicking View in toast navigates to order detail
    mockShowToast.mock.calls[0][2]?.onClick();
    expect(mockPush).toHaveBeenCalledWith("/manage/orders/ord-new-99");
  });

  it("skips sound chime when soundAlerts is disabled in settings", () => {
    render(
      <OrderAlertsProvider initialSoundAlerts={false} pollIntervalMs={0}>
        <TestConsumer />
      </OrderAlertsProvider>,
    );

    expect(screen.getByTestId("test-sound").textContent).toBe("off");

    act(() => {
      screen.getByTestId("btn-trigger").click();
    });

    // Toast still appears
    expect(mockShowToast).toHaveBeenCalledTimes(1);

    // Audio chime skipped!
    expect(playChimeSpy).not.toHaveBeenCalled();
  });

  it("resets badge count when clearNewOrdersBadge is invoked", () => {
    render(
      <OrderAlertsProvider initialSoundAlerts={true} pollIntervalMs={0}>
        <TestConsumer />
      </OrderAlertsProvider>,
    );

    act(() => {
      screen.getByTestId("btn-trigger").click();
    });
    expect(screen.getByTestId("test-count").textContent).toBe("1");

    act(() => {
      screen.getByTestId("btn-clear").click();
    });
    expect(screen.getByTestId("test-count").textContent).toBe("0");
  });

  it("renders orders navigation badge in ManagerBottomNav and ManagerSidebar when newOrdersCount > 0", () => {
    render(
      <OrderAlertsProvider initialSoundAlerts={true} pollIntervalMs={0} initialNewCount={3}>
        <ManagerBottomNav navDict={dict.nav} quickAddDict={dict.quickAdd} />
        <ManagerSidebar navDict={dict.nav} quickAddDict={dict.quickAdd} />
      </OrderAlertsProvider>,
    );

    const bottomBadge = screen.getByTestId("orders-nav-badge");
    expect(bottomBadge).toBeDefined();
    expect(bottomBadge.textContent).toBe("3");

    const sidebarBadge = screen.getByTestId("orders-sidebar-badge");
    expect(sidebarBadge).toBeDefined();
    expect(sidebarBadge.textContent).toBe("3");
  });

  it("does not render navigation badges when newOrdersCount is 0", () => {
    render(
      <OrderAlertsProvider initialSoundAlerts={true} pollIntervalMs={0} initialNewCount={0}>
        <ManagerBottomNav navDict={dict.nav} quickAddDict={dict.quickAdd} />
        <ManagerSidebar navDict={dict.nav} quickAddDict={dict.quickAdd} />
      </OrderAlertsProvider>,
    );

    expect(screen.queryByTestId("orders-nav-badge")).toBeNull();
    expect(screen.queryByTestId("orders-sidebar-badge")).toBeNull();
  });

  it("provides safe fallback defaults when useOrderAlerts is used outside of provider", () => {
    function StandaloneConsumer() {
      const { newOrdersCount, soundAlerts, setSoundAlerts, clearNewOrdersBadge } = useOrderAlerts();
      return (
        <div>
          <span data-testid="fallback-count">{newOrdersCount}</span>
          <span data-testid="fallback-sound">{soundAlerts ? "true" : "false"}</span>
          <button data-testid="fallback-toggle" onClick={() => setSoundAlerts(false)}>
            Toggle
          </button>
          <button data-testid="fallback-clear" onClick={clearNewOrdersBadge}>
            Clear
          </button>
        </div>
      );
    }

    render(<StandaloneConsumer />);
    expect(screen.getByTestId("fallback-count").textContent).toBe("0");
    expect(screen.getByTestId("fallback-sound").textContent).toBe("true");
    expect(() => screen.getByTestId("fallback-toggle").click()).not.toThrow();
    expect(() => screen.getByTestId("fallback-clear").click()).not.toThrow();
  });

  describe("Realtime postgres_changes subscription (#124)", () => {
    const testBizId = "10000000-0000-0000-0000-000000000001";

    it("subscribes to orders:business:${businessId} with event INSERT and business_id filter", () => {
      const mock = createMockSupabaseClient();

      render(
        <OrderAlertsProvider
          businessId={testBizId}
          supabaseClient={mock.client}
          initialSoundAlerts={true}
          pollIntervalMs={0}
        >
          <TestConsumer />
        </OrderAlertsProvider>,
      );

      expect(mock.client.channel).toHaveBeenCalledWith(`orders:business:${testBizId}`);
      expect(mock.mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `business_id=eq.${testBizId}`,
        },
        expect.any(Function),
      );
      expect(mock.mockChannel.subscribe).toHaveBeenCalledTimes(1);
    });

    it("triggers toast, sound chime, and increments count when a NEW order arrives via Realtime", async () => {
      const mock = createMockSupabaseClient();

      render(
        <OrderAlertsProvider
          businessId={testBizId}
          supabaseClient={mock.client}
          initialSoundAlerts={true}
          pollIntervalMs={0}
        >
          <TestConsumer />
        </OrderAlertsProvider>,
      );

      // Complete initial check (setTimeout 0)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(screen.getByTestId("test-count").textContent).toBe("0");

      const callback = mock.getRegisteredCallback();
      expect(callback).toBeDefined();

      const newOrder: EnrichedOrder = {
        id: "ord-realtime-55",
        businessId: testBizId,
        orderNumber: 55,
        guestId: "00000000-0000-4000-8000-000000000002",
        guestName: "Realtime Pierre",
        serviceType: "delivery",
        channel: "storefront",
        status: "NEW",
        paid: "unpaid",
        paymentPreference: "on_handover",
        paymentMethod: null,
        paidAt: null,
        requestedDate: "2026-10-18",
        requestedTime: null,
        items: [],
        totalAmount: 2450,
        createdAt: "2026-10-18T10:00:00.000Z",
        updatedAt: "2026-10-18T10:00:00.000Z",
      };
      currentOrders.push(newOrder);

      await act(async () => {
        callback?.({
          new: {
            id: "ord-realtime-55",
            business_id: testBizId,
            status: "NEW",
          },
        });
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(screen.getByTestId("test-count").textContent).toBe("1");
      expect(mockShowToast).toHaveBeenCalledTimes(1);
      expect(mockShowToast.mock.calls[0][0]).toContain(
        "New Order #55 from Realtime Pierre (€24.50)",
      );
      expect(mockShowToast.mock.calls[0][2]?.label).toBe("View");
      expect(playChimeSpy).toHaveBeenCalledTimes(1);

      // Verify clicking View navigates to the order
      mockShowToast.mock.calls[0][2]?.onClick();
      expect(mockPush).toHaveBeenCalledWith("/manage/orders/ord-realtime-55");
    });

    it("ignores duplicate order IDs or non-NEW status rows received over Realtime", async () => {
      const mock = createMockSupabaseClient();

      render(
        <OrderAlertsProvider
          businessId={testBizId}
          supabaseClient={mock.client}
          initialSoundAlerts={true}
          pollIntervalMs={0}
        >
          <TestConsumer />
        </OrderAlertsProvider>,
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      const callback = mock.getRegisteredCallback();
      expect(callback).toBeDefined();

      // 1. Missing ID row should be ignored
      await act(async () => {
        callback?.({
          new: {
            status: "NEW",
            order_number: 102,
          },
        });
        await new Promise((r) => setTimeout(r, 10));
      });
      expect(screen.getByTestId("test-count").textContent).toBe("0");

      // 2. Valid NEW order is processed
      const firstOrder: EnrichedOrder = {
        id: "ord-first-time",
        businessId: testBizId,
        orderNumber: 103,
        guestId: "00000000-0000-4000-8000-000000000003",
        guestName: "Customer A",
        serviceType: "pickup",
        channel: "storefront",
        status: "NEW",
        paid: "unpaid",
        paymentPreference: "on_handover",
        paymentMethod: null,
        paidAt: null,
        requestedDate: "2026-10-18",
        requestedTime: null,
        items: [],
        totalAmount: 1500,
        createdAt: "2026-10-18T10:00:00.000Z",
        updatedAt: "2026-10-18T10:00:00.000Z",
      };
      currentOrders.push(firstOrder);

      await act(async () => {
        callback?.({
          new: {
            id: "ord-first-time",
            business_id: testBizId,
            status: "NEW",
          },
        });
        await new Promise((r) => setTimeout(r, 10));
      });
      expect(screen.getByTestId("test-count").textContent).toBe("1");
      expect(mockShowToast).toHaveBeenCalledTimes(1);

      // 3. Duplicate of the same order ID is ignored
      await act(async () => {
        callback?.({
          new: {
            id: "ord-first-time",
            business_id: testBizId,
            status: "NEW",
          },
        });
        await new Promise((r) => setTimeout(r, 10));
      });
      expect(screen.getByTestId("test-count").textContent).toBe("1");
      expect(mockShowToast).toHaveBeenCalledTimes(1);
    });

    it("removes the channel subscription when unmounting", () => {
      const mock = createMockSupabaseClient();

      const { unmount } = render(
        <OrderAlertsProvider businessId={testBizId} supabaseClient={mock.client} pollIntervalMs={0}>
          <TestConsumer />
        </OrderAlertsProvider>,
      );

      expect(mock.client.removeChannel).not.toHaveBeenCalled();

      unmount();

      expect(mock.client.removeChannel).toHaveBeenCalledWith(mock.mockChannel);
    });

    it("disables realtime subscription when businessId is absent or invalid", () => {
      const mock = createMockSupabaseClient();

      render(
        <OrderAlertsProvider businessId={undefined} supabaseClient={mock.client} pollIntervalMs={0}>
          <TestConsumer />
        </OrderAlertsProvider>,
      );

      expect(mock.client.channel).not.toHaveBeenCalled();

      render(
        <OrderAlertsProvider
          businessId="not-a-valid-uuid"
          supabaseClient={mock.client}
          pollIntervalMs={0}
        >
          <TestConsumer />
        </OrderAlertsProvider>,
      );

      expect(mock.client.channel).not.toHaveBeenCalled();
    });

    it("manages resilience: connected stops polling, error starts fallback polling with backoff resubscribe, recovery stops polling", async () => {
      vi.useFakeTimers();

      let currentStatusCb: StatusCallback | null = null;
      let subscribeCallCount = 0;

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((cb?: StatusCallback) => {
          subscribeCallCount++;
          currentStatusCb = cb ?? null;
          return mockChannel;
        }),
      };

      const mockClient = {
        channel: vi.fn(() => mockChannel),
        removeChannel: vi.fn(() => Promise.resolve("ok")),
      } as unknown as RealtimeOrderClient;

      const listSpy = vi.spyOn(actions, "listOrdersAction");

      render(
        <OrderAlertsProvider
          businessId={testBizId}
          supabaseClient={mockClient}
          pollIntervalMs={15000}
        >
          <TestConsumer />
        </OrderAlertsProvider>,
      );

      // Initial check (setTimeout 0)
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      const callsAfterMount = listSpy.mock.calls.length;

      // 1. Channel connects (SUBSCRIBED) -> triggers catch-up fetch
      await act(async () => {
        currentStatusCb?.("SUBSCRIBED", null);
      });
      const callsAfterSubscribed = listSpy.mock.calls.length;
      expect(callsAfterSubscribed).toBeGreaterThanOrEqual(callsAfterMount + 1);

      // While SUBSCRIBED, advance 30s -> NO fallback polling occurs
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      expect(listSpy.mock.calls.length).toBe(callsAfterSubscribed);

      // 2. Channel error occurs -> disconnected, fallback polling starts and backoff retry scheduled
      await act(async () => {
        currentStatusCb?.("CHANNEL_ERROR", new Error("Connection dropped"));
      });

      // Advance 15s: fallback polling triggers checkForNewOrders
      await act(async () => {
        vi.advanceTimersByTime(15000);
      });
      expect(listSpy.mock.calls.length).toBeGreaterThan(callsAfterSubscribed);

      // Verify backoff resubscribe was attempted
      expect(subscribeCallCount).toBeGreaterThanOrEqual(2);

      // 3. Recovery: channel connects again (SUBSCRIBED)
      await act(async () => {
        currentStatusCb?.("SUBSCRIBED", null);
      });
      const callsAfterRecovery = listSpy.mock.calls.length;

      // Advance 30s: fallback polling has stopped
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      expect(listSpy.mock.calls.length).toBe(callsAfterRecovery);

      vi.useRealTimers();
    });
  });
});
