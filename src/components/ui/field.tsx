import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

export interface FieldProps {
  /** Visible label text, associated with the control through `htmlFor`. */
  label: React.ReactNode;
  /**
   * One control element (`Input`, `Textarea`, …) that receives the wiring props, or a render
   * function for composites such as `Select`, where the props go on `SelectTrigger`.
   */
  children: React.ReactElement<FieldControlProps> | ((props: FieldControlProps) => React.ReactNode);
  hint?: React.ReactNode;
  /** Where the hint sits: below the control (default) or between the label and the control. */
  hintPosition?: "above" | "below";
  /** Localized, user-safe error text. Empty or missing means no error. */
  error?: string | null;
  /**
   * Whether the inline error carries `role="alert"` (default `true`). Set `false` when the parent
   * form announces errors via a single live region + focus management to avoid double announcements.
   */
  announceError?: boolean;
  required?: boolean;
  /** Overrides the generated id (keeps an existing `id` on the control stable). */
  id?: string;
  className?: string;
  "data-testid"?: string;
}

/**
 * Label + control + hint + error. Wires `id`/`htmlFor`, `aria-describedby` (hint and error),
 * `aria-invalid` and `aria-required` onto the control. The error is announced (`role="alert"`)
 * and carries an icon so it is never colour-only.
 */
export function Field({
  label,
  children,
  hint,
  hintPosition = "below",
  error,
  announceError = true,
  required,
  id,
  className,
  "data-testid": testId,
}: FieldProps) {
  const generatedId = React.useId();
  const child = React.isValidElement<FieldControlProps>(children) ? children : null;
  const controlId = id ?? child?.props.id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [child?.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ");

  const wiring: FieldControlProps = {
    id: controlId,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": error ? true : child?.props["aria-invalid"],
    "aria-required": required ? true : child?.props["aria-required"],
  };
  const control = child
    ? React.cloneElement(child, wiring)
    : (children as (props: FieldControlProps) => React.ReactNode)(wiring);

  const hintNode = (
    <p id={hintId} className="text-body-sm text-muted-foreground">
      {hint}
    </p>
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-testid={testId}>
      <label htmlFor={controlId} className="text-label-md text-foreground">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {hint && hintPosition === "above" ? hintNode : null}
      {control}
      {hint && hintPosition === "below" ? hintNode : null}
      {error ? (
        <p
          id={errorId}
          role={announceError ? "alert" : undefined}
          data-testid={testId ? `${testId}-error` : undefined}
          className="text-body-sm text-destructive flex items-start gap-1.5"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
