import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocaleHomePage from "../[locale]/page";
import RootPage from "../page";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("Internationalized storefront pages", () => {
  it("RootPage redirects to default locale /en", async () => {
    const { redirect } = await import("next/navigation");
    RootPage();
    expect(redirect).toHaveBeenCalledWith("/en");
  });

  it("LocaleHomePage renders English dictionary strings", async () => {
    const page = await LocaleHomePage({ params: Promise.resolve({ locale: "en" }) });
    render(page);
    expect(screen.getByRole("heading", { level: 1, name: "FoodBiz Manager" })).toBeDefined();
    expect(screen.getByText(/Opening hours · EN/i)).toBeDefined();
  });

  it("LocaleHomePage renders French dictionary strings", async () => {
    const page = await LocaleHomePage({ params: Promise.resolve({ locale: "fr" }) });
    render(page);
    expect(screen.getByRole("heading", { level: 1, name: "FoodBiz Manager" })).toBeDefined();
    expect(screen.getByText(/Heures d'ouverture · FR/i)).toBeDefined();
  });
});
