import { render } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { Button, Checkbox, Input, QuantityStepper, Switch, Textarea } from "../index";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../sheet";

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe.each(["light", "dark"])("%s component accessibility", (theme) => {
  it("exposes labelled form controls and quantity actions", async () => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    const { container } = render(
      <main>
        <h1>Order details</h1>
        <label htmlFor="name">Name</label>
        <Input id="name" />
        <label htmlFor="notes">Notes</label>
        <Textarea id="notes" />
        <Checkbox aria-label="Paid" />
        <Switch aria-label="Visible on menu" />
        <QuantityStepper
          value={1}
          onChange={() => {}}
          decreaseLabel="Decrease quantity"
          increaseLabel="Increase quantity"
        />
        <Button>Save</Button>
      </main>,
    );
    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      // JSDOM has no layout engine; Playwright enforces contrast with real rendered styles.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("exposes an accessible modal title, description and close action", async () => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>Choose how the customer paid.</DialogDescription>
          <Button>Confirm payment</Button>
        </DialogContent>
      </Dialog>,
    );
    const results = await axe.run(document.body, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});

// #356: close buttons meet the 36px minimum without taking a text line (DESIGN_SYSTEM.md §5).
describe("dialog and sheet close buttons", () => {
  it.each([
    [
      "dialog",
      <Dialog open key="d">
        <DialogContent>
          <DialogTitle>Install the app</DialogTitle>
          <DialogDescription>Steps</DialogDescription>
        </DialogContent>
      </Dialog>,
    ],
    [
      "sheet",
      <Sheet open key="s">
        <SheetContent>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Links</SheetDescription>
        </SheetContent>
      </Sheet>,
    ],
  ])("%s close button is 36px and sits in the corner", (_name, ui) => {
    render(ui);
    const close = document.body.querySelector("button .sr-only")?.closest("button");
    expect(close?.className).toContain("min-h-9");
    expect(close?.className).toContain("min-w-9");
    expect(close?.className).not.toContain("min-h-11");
    expect(close?.className).toContain("absolute");
  });
});
