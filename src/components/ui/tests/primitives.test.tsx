import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Input,
  Textarea,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  Switch,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  KPICard,
  ListRow,
  QuantityStepper,
  ToastProvider,
  useToast,
} from "../index";

describe("Base UI Primitives (#28)", () => {
  describe("Button", () => {
    it("renders with default props and handles click", () => {
      const handleClick = vi.fn();
      render(
        <Button data-testid="btn" onClick={handleClick}>
          Click me
        </Button>,
      );

      const btn = screen.getByTestId("btn");
      expect(btn).toBeDefined();
      expect(btn.textContent).toBe("Click me");
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("handles loading state and disables button", () => {
      render(
        <Button loading data-testid="btn">
          Submit
        </Button>,
      );
      const btn = screen.getByTestId("btn");
      expect(btn.hasAttribute("disabled")).toBe(true);
    });

    it("renders secondary and destructive variants", () => {
      render(
        <>
          <Button variant="secondary" data-testid="btn-sec">
            Secondary
          </Button>
          <Button variant="destructive" data-testid="btn-dest">
            Delete
          </Button>
        </>,
      );
      expect(screen.getByTestId("btn-sec").className).toContain("bg-primary-soft");
      expect(screen.getByTestId("btn-dest").className).toContain("bg-destructive");
    });
  });

  describe("Input & Textarea", () => {
    it("renders Input and applies error styling", () => {
      render(<Input data-testid="inp" error placeholder="Enter name" />);
      const inp = screen.getByTestId("inp");
      expect(inp.className).toContain("border-destructive");
      expect(inp.getAttribute("placeholder")).toBe("Enter name");
    });

    it("renders Textarea and applies error styling", () => {
      render(<Textarea data-testid="txt" error placeholder="Enter notes" />);
      const txt = screen.getByTestId("txt");
      expect(txt.className).toContain("border-destructive");
    });
  });

  describe("Badge", () => {
    it("renders status badges with correct semantic variants", () => {
      render(
        <>
          <Badge variant="new" data-testid="badge-new">
            New
          </Badge>
          <Badge variant="ready" data-testid="badge-ready">
            Ready
          </Badge>
          <Badge variant="preparing" data-testid="badge-preparing">
            Preparing
          </Badge>
        </>,
      );
      expect(screen.getByTestId("badge-new").className).toContain("bg-info");
      expect(screen.getByTestId("badge-ready").className).toContain("bg-primary-soft");
      expect(screen.getByTestId("badge-preparing").className).toContain("bg-warning-soft");
    });
  });

  describe("Card", () => {
    it("renders card structure with header and content", () => {
      render(
        <Card data-testid="card">
          <CardHeader>
            <CardTitle>Daily Sales</CardTitle>
          </CardHeader>
          <CardContent>Content body</CardContent>
        </Card>,
      );
      expect(screen.getByTestId("card")).toBeDefined();
      expect(screen.getByText("Daily Sales")).toBeDefined();
      expect(screen.getByText("Content body")).toBeDefined();
    });
  });

  describe("Skeleton", () => {
    it("renders with reduced motion safe styling", () => {
      render(<Skeleton data-testid="skel" className="h-6 w-24" />);
      const skel = screen.getByTestId("skel");
      expect(skel.className).toContain("bg-muted");
      expect(skel.className).toContain("motion-reduce:animate-none");
    });
  });

  describe("Switch & Checkbox", () => {
    it("renders Switch and toggles on click", () => {
      render(<Switch data-testid="switch" />);
      const sw = screen.getByTestId("switch");
      expect(sw.getAttribute("data-state")).toBe("unchecked");
      fireEvent.click(sw);
      expect(sw.getAttribute("data-state")).toBe("checked");
    });

    it("renders Checkbox and toggles on click", () => {
      render(<Checkbox data-testid="cb" />);
      const cb = screen.getByTestId("cb");
      expect(cb.getAttribute("data-state")).toBe("unchecked");
      fireEvent.click(cb);
      expect(cb.getAttribute("data-state")).toBe("checked");
    });
  });

  describe("Tabs", () => {
    it("renders tabs and switches active tab", () => {
      render(
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">
              All
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">
              Active
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all" data-testid="content-all">
            All Content
          </TabsContent>
          <TabsContent value="active" data-testid="content-active">
            Active Content
          </TabsContent>
        </Tabs>,
      );

      expect(screen.getByTestId("tab-all").getAttribute("data-state")).toBe("active");
      expect(screen.getByTestId("tab-active").getAttribute("data-state")).toBe("inactive");
      expect(screen.getByTestId("content-all")).toBeDefined();

      const activeTab = screen.getByTestId("tab-active");
      fireEvent.keyDown(activeTab, { key: "Enter" });
      expect(activeTab.getAttribute("data-state")).toBe("active");
    });
  });

  describe("KPICard", () => {
    it("renders label, display value, and delta", () => {
      render(
        <KPICard
          data-testid="kpi"
          label="Today's Revenue"
          value="€842.50"
          delta={{ percentage: 12.4, isPositive: true, periodLabel: "vs yesterday" }}
        />,
      );
      expect(screen.getByText("Today's Revenue")).toBeDefined();
      expect(screen.getByText("€842.50")).toBeDefined();
      expect(screen.getByText("+12.4%")).toBeDefined();
      expect(screen.getByText("vs yesterday")).toBeDefined();
    });
  });

  describe("ListRow", () => {
    it("renders row and triggers onClick on click and Enter", () => {
      const handleClick = vi.fn();
      render(
        <ListRow
          data-testid="row"
          title="Croissant"
          subtitle="Stock: 14"
          trailing="€2.50"
          onClick={handleClick}
        />,
      );

      const row = screen.getByTestId("row");
      expect(screen.getByText("Croissant")).toBeDefined();
      expect(screen.getByText("Stock: 14")).toBeDefined();
      expect(screen.getByText("€2.50")).toBeDefined();

      fireEvent.click(row);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(row, { key: "Enter" });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe("QuantityStepper", () => {
    it("increments and decrements value within bounds", () => {
      const handleChange = vi.fn();
      render(
        <QuantityStepper data-testid="stepper" value={2} min={1} max={5} onChange={handleChange} />,
      );

      expect(screen.getByTestId("quantity-value").textContent).toBe("2");

      fireEvent.click(screen.getByTestId("quantity-increment"));
      expect(handleChange).toHaveBeenCalledWith(3);

      fireEvent.click(screen.getByTestId("quantity-decrement"));
      expect(handleChange).toHaveBeenCalledWith(1);
    });
  });

  describe("Toast", () => {
    function ToastTrigger() {
      const { showToast } = useToast();
      return (
        <button data-testid="trigger-toast" onClick={() => showToast("Test notification")}>
          Toast
        </button>
      );
    }

    it("displays toast message when triggered", () => {
      render(
        <ToastProvider>
          <ToastTrigger />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByTestId("trigger-toast"));
      expect(screen.getByText("Test notification")).toBeDefined();
    });
  });
});
