import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentActivityFeed } from "../components/recent-activity-feed";
import type { ActivityFeedItem } from "@/domain";

const mockActivity: ActivityFeedItem[] = [
  {
    id: "o-1",
    type: "order",
    orderNumber: 1043,
    guestName: "Alice",
    paymentMethod: "cash",
    amount: 1850,
    timestamp: new Date().toISOString(),
    statusKey: "paid",
    statusVariant: "paid",
    href: "/manage/orders/o-1",
  },
  {
    id: "e-1",
    type: "expense",
    description: "Metro Cash & Carry",
    tags: "Ingredients",
    amount: 6500,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    statusKey: "expense",
    statusVariant: "expense",
    href: "/manage/expenses",
  },
  {
    id: "o-2",
    type: "order",
    orderNumber: 1042,
    guestName: "Bob",
    amount: 3600,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    statusKey: "unpaid",
    statusVariant: "unpaid",
    href: "/manage/orders/o-2",
  },
];

describe("RecentActivityFeed Component", () => {
  it("renders chronological feed of mixed orders and expenses with details", () => {
    render(<RecentActivityFeed items={mockActivity} now={new Date().toISOString()} />);

    expect(screen.getByTestId("recent-activity-section")).toBeDefined();
    expect(screen.getByText("Recent activity")).toBeDefined();

    expect(screen.getByText("Order #1043")).toBeDefined();
    expect(screen.getByText("Metro Cash & Carry")).toBeDefined();
    expect(screen.getByText("Order #1042")).toBeDefined();

    expect(screen.getByText("€18.50")).toBeDefined();
    expect(screen.getByText("- €65.00")).toBeDefined();
    expect(screen.getByText("€36.00")).toBeDefined();

    const orderLink = screen.getByTestId("activity-item-order-o-1");
    expect(orderLink.getAttribute("href")).toBe("/manage/orders/o-1");

    const expenseLink = screen.getByTestId("activity-item-expense-e-1");
    expect(expenseLink.getAttribute("href")).toBe("/manage/expenses");
  });

  it("renders empty state when there are no activities", () => {
    render(<RecentActivityFeed items={[]} now={new Date().toISOString()} />);

    expect(screen.getByText("No recent activity yet")).toBeDefined();
  });
});
