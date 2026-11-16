import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/domain/i18n";
import LocaleError from "../error";

let mockParams: { locale?: string } = { locale: "fr" };
vi.mock("next/navigation", () => ({ useParams: () => mockParams }));

describe("storefront error boundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows a localized alert and retries on demand", () => {
    const retry = vi.fn();
    render(<LocaleError error={new Error("db down")} retry={retry} />);
    const fr = getDictionary("fr").storefront;

    expect(screen.getByRole("alert").textContent).toContain(fr.pageErrorTitle);
    expect(screen.getByRole("alert").textContent).not.toContain("db down");
    fireEvent.click(screen.getByRole("button", { name: fr.pageErrorRetry }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default locale for unknown locales", () => {
    mockParams = { locale: "xx" };
    render(<LocaleError error={new Error("x")} retry={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain(
      getDictionary("en").storefront.pageErrorTitle,
    );
    mockParams = { locale: "fr" };
  });
});
