import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryNav, useScrollPastSentinel, useScrollSpy } from "../index";

const sampleItems = [
  { id: "grills", label: "Grills" },
  { id: "traditional", label: "Traditional" },
  { id: "fritters", label: "Fritters" },
];

type ObserverCallback = IntersectionObserverCallback;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: ObserverCallback;
  observedElements: Element[] = [];
  disconnected = false;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observedElements.push(el);
  }

  unobserve(el: Element) {
    this.observedElements = this.observedElements.filter((item) => item !== el);
  }

  disconnect() {
    this.disconnected = true;
  }

  trigger(entries: Array<Partial<IntersectionObserverEntry> & { target: Element }>) {
    this.callback(
      entries.map(
        (entry) =>
          ({
            isIntersecting: false,
            intersectionRatio: 0,
            boundingClientRect: entry.target.getBoundingClientRect(),
            intersectionRect: entry.target.getBoundingClientRect(),
            rootBounds: null,
            time: Date.now(),
            ...entry,
          }) as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }
}

describe("CategoryNav & useScrollSpy (#200)", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("CategoryNav component", () => {
    it("renders horizontal tabs with active state, list icon button, and trailing slot", () => {
      const onSelect = vi.fn();
      render(
        <CategoryNav
          items={sampleItems}
          activeId="traditional"
          onSelect={onSelect}
          menuTitle="Menu"
          menuSubtitle="11:00 – 21:00"
          menuLabel="Browse categories"
          dismissLabel="Dismiss"
          trailing={<button data-testid="search-launcher">Search</button>}
        />,
      );

      expect(screen.getByTestId("category-nav")).toBeDefined();
      expect(screen.getByRole("button", { name: "Browse categories" })).toBeDefined();
      expect(screen.getByTestId("search-launcher")).toBeDefined();

      const grillsTab = screen.getByTestId("category-nav-tab-grills");
      const activeTab = screen.getByTestId("category-nav-tab-traditional");

      expect(grillsTab.getAttribute("aria-current")).toBeNull();
      expect(activeTab.getAttribute("aria-current")).toBe("true");

      fireEvent.click(grillsTab);
      expect(onSelect).toHaveBeenCalledWith("grills");
    });

    it("auto-scrolls active tab into view respecting prefers-reduced-motion", () => {
      const scrollIntoViewMock = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      vi.stubGlobal(
        "matchMedia",
        vi.fn().mockImplementation((query: string) => ({
          matches: query.includes("reduce"),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );

      const { rerender } = render(
        <CategoryNav
          items={sampleItems}
          activeId="grills"
          onSelect={vi.fn()}
          menuTitle="Menu"
          menuLabel="Browse categories"
          dismissLabel="Dismiss"
        />,
      );

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });

      scrollIntoViewMock.mockClear();
      vi.stubGlobal(
        "matchMedia",
        vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );

      rerender(
        <CategoryNav
          items={sampleItems}
          activeId="fritters"
          onSelect={vi.fn()}
          menuTitle="Menu"
          menuLabel="Browse categories"
          dismissLabel="Dismiss"
        />,
      );

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    });

    it("opens Menu sheet, highlights current category, selects an item, or dismisses", () => {
      const onSelect = vi.fn();
      render(
        <CategoryNav
          items={sampleItems}
          activeId="traditional"
          onSelect={onSelect}
          menuTitle="Menu"
          menuSubtitle="11:00 – 21:00"
          menuLabel="Browse categories"
          dismissLabel="Dismiss"
        />,
      );

      fireEvent.click(screen.getByTestId("category-nav-menu-button"));

      expect(screen.getByTestId("category-nav-sheet")).toBeDefined();
      expect(screen.getByRole("heading", { name: "Menu" })).toBeDefined();
      expect(screen.getByText("11:00 – 21:00")).toBeDefined();

      const sheetActiveItem = screen.getByTestId("category-nav-sheet-item-traditional");
      const sheetFrittersItem = screen.getByTestId("category-nav-sheet-item-fritters");

      expect(sheetActiveItem.getAttribute("aria-current")).toBe("true");
      expect(sheetFrittersItem.getAttribute("aria-current")).toBeNull();

      // Dismiss without selecting
      fireEvent.click(screen.getByTestId("category-nav-sheet-dismiss"));
      expect(screen.queryByTestId("category-nav-sheet")).toBeNull();
      expect(onSelect).not.toHaveBeenCalled();

      // Re-open and select an item
      fireEvent.click(screen.getByTestId("category-nav-menu-button"));
      fireEvent.click(screen.getByTestId("category-nav-sheet-item-fritters"));

      expect(onSelect).toHaveBeenCalledWith("fritters");
      expect(screen.queryByTestId("category-nav-sheet")).toBeNull();
    });
  });

  describe("useScrollSpy hook", () => {
    it("computes active section from IntersectionObserver entries and cleans up", () => {
      const s1 = document.createElement("section");
      s1.id = "category-section-grills";
      const s2 = document.createElement("section");
      s2.id = "category-section-traditional";
      document.body.append(s1, s2);

      const { result, unmount } = renderHook(() => useScrollSpy(["grills", "traditional"]));

      expect(result.current.activeId).toBe("grills");
      expect(MockIntersectionObserver.instances.length).toBe(1);
      const observer = MockIntersectionObserver.instances[0];
      expect(observer.observedElements).toEqual([s1, s2]);

      act(() => {
        observer.trigger([
          { target: s1, isIntersecting: false },
          { target: s2, isIntersecting: true },
        ]);
      });

      expect(result.current.activeId).toBe("traditional");

      unmount();
      expect(observer.disconnected).toBe(true);
      s1.remove();
      s2.remove();
    });

    it("handles empty section list", () => {
      const { result } = renderHook(() => useScrollSpy([]));
      expect(result.current.activeId).toBeNull();
    });
  });

  describe("useScrollPastSentinel hook", () => {
    it("toggles isPast when sentinel scrolls past top and returns into view", () => {
      const sentinel = document.createElement("div");
      document.body.appendChild(sentinel);

      const { result } = renderHook(() => useScrollPastSentinel(true));
      expect(result.current.isPast).toBe(false);

      act(() => {
        result.current.sentinelRef(sentinel);
      });

      const observer = MockIntersectionObserver.instances.at(-1)!;
      expect(observer.observedElements).toContain(sentinel);

      act(() => {
        observer.trigger([
          {
            target: sentinel,
            isIntersecting: false,
            boundingClientRect: { top: -12 } as DOMRectReadOnly,
          },
        ]);
      });
      expect(result.current.isPast).toBe(true);

      // Ignore non-intersecting below viewport (top > 56)
      act(() => {
        observer.trigger([{ target: sentinel, isIntersecting: true }]);
      });
      expect(result.current.isPast).toBe(false);

      act(() => {
        observer.trigger([
          {
            target: sentinel,
            isIntersecting: false,
            boundingClientRect: { top: 400 } as DOMRectReadOnly,
          },
        ]);
      });
      expect(result.current.isPast).toBe(false);

      sentinel.remove();
    });
  });
});
