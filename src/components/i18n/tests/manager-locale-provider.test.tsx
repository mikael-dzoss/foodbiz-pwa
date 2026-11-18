import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManagerLocaleProvider, useManagerLocale } from "../manager-locale-provider";

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
});
