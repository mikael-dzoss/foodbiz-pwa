import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ActionBar,
  ConfirmDialog,
  Field,
  Input,
  SegmentedControl,
  Select,
  SelectTrigger,
  SelectValue,
} from "../index";

describe("Field", () => {
  it("associates the label, hint and error with the control", () => {
    render(
      <Field label="Name" hint="Shown to customers" error="Required" required data-testid="f-name">
        <Input data-testid="inp" />
      </Field>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toBe(screen.getByTestId("inp"));
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-required")).toBe("true");
    const describedBy = (input.getAttribute("aria-describedby") ?? "").split(" ");
    expect(describedBy).toHaveLength(2);
    expect(document.getElementById(describedBy[0])?.textContent).toBe("Shown to customers");
    const error = screen.getByRole("alert");
    expect(error.id).toBe(describedBy[1]);
    expect(error.textContent).toBe("Required");
    expect(screen.getByTestId("f-name-error")).toBe(error);
  });

  it("omits invalid and described-by wiring when there is nothing to describe", () => {
    render(
      <Field label="Email">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.hasAttribute("aria-describedby")).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps an explicit id and any existing aria-describedby", () => {
    render(
      <Field label="Phone" id="phone-field" error="Bad">
        <Input aria-describedby="extra" />
      </Field>,
    );
    const input = screen.getByLabelText("Phone");
    expect(input.id).toBe("phone-field");
    expect(input.getAttribute("aria-describedby")).toBe("extra phone-field-error");
  });

  it("wires a select trigger", () => {
    render(
      <Field label="Category" error="Pick one">
        {(props) => (
          <Select>
            <SelectTrigger {...props}>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
          </Select>
        )}
      </Field>,
    );
    expect(screen.getByLabelText("Category").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("ConfirmDialog", () => {
  const setup = (props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete product?"
        description="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={onConfirm}
        data-testid="cd"
        {...props}
      />,
    );
    return { onConfirm, onOpenChange };
  };

  it("confirms and cancels", () => {
    const { onConfirm, onOpenChange } = setup();
    expect(screen.getByRole("dialog").getAttribute("data-testid")).toBe("cd");
    expect(screen.getByText("This cannot be undone.")).toBeDefined();
    fireEvent.click(screen.getByTestId("cd-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("cd-cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("destructive variant: alertdialog, destructive confirm, focus starts on Cancel", () => {
    setup({ destructive: true });
    expect(screen.getByRole("alertdialog")).toBeDefined();
    expect(screen.getByTestId("cd-confirm").className).toContain("bg-destructive");
    expect(document.activeElement).toBe(screen.getByTestId("cd-cancel"));
  });

  it("loading disables both buttons", () => {
    setup({ loading: true });
    expect((screen.getByTestId("cd-confirm") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("cd-cancel") as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders nothing when closed", () => {
    setup({ open: false });
    expect(screen.queryByTestId("cd")).toBeNull();
  });
});

describe("ActionBar", () => {
  it("sits above the bottom nav and is static from md", () => {
    render(
      <ActionBar data-testid="bar">
        <button type="button">Save</button>
      </ActionBar>,
    );
    const bar = screen.getByTestId("bar");
    expect(bar.className).toContain("bottom-above-nav");
    expect(bar.className).toContain("fixed");
    expect(bar.className).toContain("md:static");
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  });

  it("supports the bottom and floating placements and class overrides", () => {
    render(
      <>
        <ActionBar placement="bottom" data-testid="b" className="z-50" />
        <ActionBar placement="floating" data-testid="f" contentClassName="flex" />
      </>,
    );
    expect(screen.getByTestId("b").className).toContain("bottom-0");
    expect(screen.getByTestId("b").className).toContain("pb-safe-min-4");
    expect(screen.getByTestId("b").className).toContain("z-50");
    expect(screen.getByTestId("f").className).toContain("bottom-sticky-safe");
    expect(screen.getByTestId("f").className).toContain("sticky");
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "a", label: "A", "data-testid": "opt-a" },
    { value: "b", label: "B", disabled: true, "data-testid": "opt-b" },
    { value: "c", label: "C", "data-testid": "opt-c" },
  ] as const;

  function Harness({ initial = "a" }: { initial?: "a" | "b" | "c" }) {
    const [value, setValue] = React.useState<"a" | "b" | "c">(initial);
    return (
      <SegmentedControl
        aria-label="Pick"
        value={value}
        onValueChange={setValue}
        options={options}
      />
    );
  }

  it("is a radiogroup with a roving tabindex", () => {
    render(<Harness />);
    expect(screen.getByRole("radiogroup", { name: "Pick" })).toBeDefined();
    expect(screen.getByTestId("opt-a").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("opt-a").tabIndex).toBe(0);
    expect(screen.getByTestId("opt-c").tabIndex).toBe(-1);
  });

  it("arrow keys move focus and selection, skipping disabled options and wrapping", () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByTestId("opt-a"), { key: "ArrowRight" });
    expect(screen.getByTestId("opt-c").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(screen.getByTestId("opt-c"));
    fireEvent.keyDown(screen.getByTestId("opt-c"), { key: "ArrowRight" });
    expect(screen.getByTestId("opt-a").getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(screen.getByTestId("opt-a"), { key: "ArrowLeft" });
    expect(screen.getByTestId("opt-c").getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(screen.getByTestId("opt-c"), { key: "Home" });
    expect(screen.getByTestId("opt-a").getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(screen.getByTestId("opt-a"), { key: "End" });
    expect(screen.getByTestId("opt-c").getAttribute("aria-checked")).toBe("true");
  });

  it("ignores other keys and click selects", () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByTestId("opt-a"), { key: "x" });
    expect(screen.getByTestId("opt-a").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByTestId("opt-c"));
    expect(screen.getByTestId("opt-c").getAttribute("aria-checked")).toBe("true");
  });

  it("keeps unavailable options focusable and reports the selection attempt", () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Mode"
        value="a"
        onValueChange={onValueChange}
        options={[
          { value: "a", label: "A", "data-testid": "m-a" },
          { value: "b", label: "B", unavailable: true, "data-testid": "m-b" },
        ]}
      />,
    );
    const unavailable = screen.getByTestId("m-b");
    expect(unavailable.getAttribute("aria-disabled")).toBe("true");
    expect((unavailable as HTMLButtonElement).disabled).toBe(false);
    fireEvent.keyDown(screen.getByTestId("m-a"), { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalledWith("b");
    expect(document.activeElement).toBe(unavailable);
  });
});
