import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagerShell } from "../components/manager-shell";
import { enDictionary } from "@/domain/i18n";

vi.mock("next/navigation", () => ({
  usePathname: () => "/manage",
}));

afterEach(() => {
  cleanup();
});

describe("Manager App Shell & Navigation (#29)", () => {
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
});
