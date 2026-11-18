import type { ReactElement } from "react";
import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagerShell } from "../components/manager-shell";
import { enDictionary } from "@/domain/i18n";
import { ToastProvider } from "@/components/ui";

// The shell hosts SoonItem rows, which need the root ToastProvider the app layout provides.
const render = (ui: ReactElement) => rtlRender(<ToastProvider>{ui}</ToastProvider>);

const { pathname } = vi.hoisted(() => ({ pathname: vi.fn(() => "/manage") }));
vi.mock("next/navigation", () => ({
  usePathname: pathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

beforeEach(() => {
  pathname.mockReturnValue("/manage");
});

describe("Manager App Shell & Navigation (#29)", () => {
  it.each([
    "/manage/customers/44444444-4444-4444-8444-444444444401",
    "/manage/orders/66666666-6666-4666-8666-666666666636",
  ])("omits the mobile bottom navigation on detail route %s", (route) => {
    pathname.mockReturnValue(route);
    render(
      <ManagerShell navDict={enDictionary.nav} quickAddDict={enDictionary.quickAdd}>
        <div>Detail view</div>
      </ManagerShell>,
    );
    expect(screen.queryByRole("navigation", { name: /Manager mobile navigation/i })).toBeNull();
    expect(screen.getByRole("complementary", { name: /Manager desktop sidebar/i })).toBeDefined();
  });

  it("keeps the mobile bottom navigation on the customer list", () => {
    pathname.mockReturnValue("/manage/customers");
    render(
      <ManagerShell navDict={enDictionary.nav} quickAddDict={enDictionary.quickAdd}>
        <div>Customer list</div>
      </ManagerShell>,
    );
    expect(screen.getByRole("navigation", { name: /Manager mobile navigation/i })).toBeDefined();
  });

  it("starts with a skip link that targets the focusable main landmark", () => {
    render(
      <ManagerShell navDict={enDictionary.nav} quickAddDict={enDictionary.quickAdd}>
        <div>Dashboard View</div>
      </ManagerShell>,
    );
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip.getAttribute("href")).toBe("#main-content");
    expect(document.querySelector("a[href], button")).toBe(skip);
    const main = screen.getByRole("main");
    expect(main.id).toBe("main-content");
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("renders both mobile bottom nav and desktop sidebar", () => {
    render(
      <ManagerShell navDict={enDictionary.nav} quickAddDict={enDictionary.quickAdd}>
        <div>Dashboard View</div>
      </ManagerShell>,
    );

    expect(screen.getByText("Dashboard View")).toBeDefined();
    expect(screen.getByRole("navigation", { name: /Manager mobile navigation/i })).toBeDefined();
    expect(screen.getByRole("complementary", { name: /Manager desktop sidebar/i })).toBeDefined();
  });

  it("marks active route on mobile navigation with aria-current", () => {
    render(
      <ManagerShell navDict={enDictionary.nav} quickAddDict={enDictionary.quickAdd}>
        <div>Dashboard View</div>
      </ManagerShell>,
    );

    const activeLinks = screen.getAllByRole("link", { current: "page" });
    expect(activeLinks.length).toBeGreaterThan(0);
    expect(activeLinks[0]?.getAttribute("href")).toBe("/manage");
  });

  it("opens quick-add sheet when Add button is clicked", () => {
    render(
      <ManagerShell navDict={enDictionary.nav} quickAddDict={enDictionary.quickAdd}>
        <div>Dashboard View</div>
      </ManagerShell>,
    );

    // Click the mobile add button
    const mobileNav = screen.getByRole("navigation", { name: /Manager mobile navigation/i });
    const addButton = screen.getAllByRole("button", { name: enDictionary.nav.add })[1] ?? mobileNav;
    fireEvent.click(addButton);

    // Sheet should be opened
    expect(screen.getByRole("heading", { name: enDictionary.quickAdd.title })).toBeDefined();
    expect(screen.getByText(enDictionary.quickAdd.newOrder)).toBeDefined();
    expect(screen.getByText(enDictionary.quickAdd.newProduct)).toBeDefined();
    expect(screen.getByText(enDictionary.quickAdd.newExpense)).toBeDefined();
  });

  it("handles desktop sidebar add button click", () => {
    render(
      <ManagerShell navDict={enDictionary.nav} quickAddDict={enDictionary.quickAdd}>
        <div>Dashboard View</div>
      </ManagerShell>,
    );

    const desktopSidebar = screen.getByRole("complementary", { name: /Manager desktop sidebar/i });
    const addButton =
      screen.getAllByRole("button", { name: enDictionary.nav.add })[0] ?? desktopSidebar;
    fireEvent.click(addButton);

    expect(screen.getByRole("heading", { name: enDictionary.quickAdd.title })).toBeDefined();

    // Click quick action link
    const newOrderLink = screen.getByText(enDictionary.quickAdd.newOrder);
    fireEvent.click(newOrderLink);
  });

  it("opens more-menu sheet when More button is clicked on mobile", () => {
    render(
      <ManagerShell navDict={enDictionary.nav} quickAddDict={enDictionary.quickAdd}>
        <div>Dashboard View</div>
      </ManagerShell>,
    );

    const moreButton = screen.getByRole("button", { name: enDictionary.nav.more });
    fireEvent.click(moreButton);

    expect(screen.getByRole("heading", { name: /More Options/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Categories/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Expenses/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Settings/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Sign out/i })).toBeDefined();
  });
});
