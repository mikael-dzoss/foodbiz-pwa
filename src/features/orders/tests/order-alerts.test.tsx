import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
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
    businessId: "biz-1",
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
  new: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
}) => void;

function createMockSupabaseClient() {
  let registeredCallback: RealtimeCallback | null = null;
  let registeredEvent = "";
  let registeredFilter = {};

  const mockChannel = {
    on: vi.fn((event: string, filter: Record<string, unknown>, callback: RealtimeCallback) => {
      registeredEvent = event;
      registeredFilter = filter;
      registeredCallback = callback;
      return mockChannel;
    }),
    subscribe: vi.fn(() => mockChannel),
  };

  const client = {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(() => Promise.resolve("ok")),
  } as unknown as SupabaseClient<Database>;

  return {
    client,
    mockChannel,
    getRegisteredCallback: () => registeredCallback,
    getRegisteredEvent: () => registeredEvent,
    getRegisteredFilter: () => registeredFilter,
  };
}

describe("Order Alerts & Notifications (Story #56 & #124)", () => {
  let playChimeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    playChimeSpy = vi.spyOn(chimeModule, "playOrderChime").mockImplementation(() => {});

    vi.spyOn(actions, "listOrdersAction").mockResolvedValue({
      success: true,
      data: {
        orders: [...initialMockOrders],
        counts: {
          active: 1,
          completed: 0,
          cancelled: 0,
          total: 1,
          unpaid: 0,
          pickup: 1,
          delivery: 0,
        },
      },
    });
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
    it("subscribes to orders:business:${businessId} with event INSERT and business_id filter", () => {
      const mock = createMockSupabaseClient();
      const testBizId = "biz-custom-789";

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

    it("triggers toast, sound chime, and increments count when a NEW order arrives via Realtime", () => {
      const mock = createMockSupabaseClient();
      const testBizId = "biz-rt-123";

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

      expect(screen.getByTestId("test-count").textContent).toBe("0");

      const callback = mock.getRegisteredCallback();
      expect(callback).toBeDefined();

      act(() => {
        callback?.({
          new: {
            id: "ord-realtime-55",
            business_id: testBizId,
            order_number: 55,
            submitted_name: "Realtime Pierre",
            service_type: "delivery",
            channel: "storefront",
            status: "NEW",
            paid: "unpaid",
            payment_preference: "on_handover",
            total_amount: 2450,
            created_at: "2026-10-18T10:00:00.000Z",
            updated_at: "2026-10-18T10:00:00.000Z",
          },
        });
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

    it("ignores duplicate order IDs or non-NEW status rows received over Realtime", () => {
      const mock = createMockSupabaseClient();
      const testBizId = "biz-rt-dup";

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

      const callback = mock.getRegisteredCallback();
      expect(callback).toBeDefined();

      // 1. Non-NEW status row should be ignored
      act(() => {
        callback?.({
          new: {
            id: "ord-rt-ignored",
            business_id: testBizId,
            status: "CONFIRMED",
            order_number: 101,
          },
        });
      });
      expect(screen.getByTestId("test-count").textContent).toBe("0");
      expect(mockShowToast).not.toHaveBeenCalled();

      // 2. Missing ID row should be ignored
      act(() => {
        callback?.({
          new: {
            status: "NEW",
            order_number: 102,
          },
        });
      });
      expect(screen.getByTestId("test-count").textContent).toBe("0");

      // 3. Valid NEW order is processed
      act(() => {
        callback?.({
          new: {
            id: "ord-first-time",
            business_id: testBizId,
            status: "NEW",
            order_number: 103,
            submitted_name: "Customer A",
            total_amount: 1500,
          },
        });
      });
      expect(screen.getByTestId("test-count").textContent).toBe("1");
      expect(mockShowToast).toHaveBeenCalledTimes(1);

      // 4. Duplicate of the same order ID is ignored
      act(() => {
        callback?.({
          new: {
            id: "ord-first-time",
            business_id: testBizId,
            status: "NEW",
            order_number: 103,
            submitted_name: "Customer A",
            total_amount: 1500,
          },
        });
      });
      expect(screen.getByTestId("test-count").textContent).toBe("1");
      expect(mockShowToast).toHaveBeenCalledTimes(1);
    });

    it("removes the channel subscription when unmounting", () => {
      const mock = createMockSupabaseClient();
      const testBizId = "biz-unmount";

      const { unmount } = render(
        <OrderAlertsProvider businessId={testBizId} supabaseClient={mock.client} pollIntervalMs={0}>
          <TestConsumer />
        </OrderAlertsProvider>,
      );

      expect(mock.client.removeChannel).not.toHaveBeenCalled();

      unmount();

      expect(mock.client.removeChannel).toHaveBeenCalledWith(mock.mockChannel);
    });
  });
});
