import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HtmlLangSync, ManagerLocaleProvider, useManagerLocale } from "../manager-locale-provider";

function Probe() {
  const { locale, dict } = useManagerLocale();
  return (
    <p data-testid="probe">
      {locale}:{dict.nav.orders}
    </p>
  );
}

describe("ManagerLocaleProvider", () => {
  it("defaults to English without a provider", () => {
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("en:Orders");
  });

  it("provides the French dictionary", () => {
    render(
      <ManagerLocaleProvider locale="fr">
        <Probe />
      </ManagerLocaleProvider>,
    );
    expect(screen.getByTestId("probe").textContent).toBe("fr:Commandes");
  });

  it("keeps <html lang> on the active locale", () => {
    const { rerender } = render(<HtmlLangSync locale="fr" />);
    expect(document.documentElement.lang).toBe("fr");
    rerender(<HtmlLangSync locale="en" />);
    expect(document.documentElement.lang).toBe("en");
  });
});
