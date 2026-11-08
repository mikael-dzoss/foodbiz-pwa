import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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

describe("Order Alerts & Notifications (Story #56)", () => {
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
});
