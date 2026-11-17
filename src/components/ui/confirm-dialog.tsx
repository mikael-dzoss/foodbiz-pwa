"use client";

import * as React from "react";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** Destructive styling, `role="alertdialog"`, and initial focus on Cancel. */
  destructive?: boolean;
  /** Disables both buttons and shows the spinner on Confirm while the action runs. */
  loading?: boolean;
  /** Test id of the dialog; the buttons are `<id>-confirm` and `<id>-cancel`. */
  "data-testid"?: string;
  /** Overrides for existing button test ids. */
  confirmTestId?: string;
  cancelTestId?: string;
}

/** Confirmation built on `Dialog`. The caller owns `open` and closes it from `onConfirm`. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = false,
  loading = false,
  "data-testid": testId = "confirm-dialog",
  confirmTestId,
  cancelTestId,
}: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid={testId}
        role={destructive ? "alertdialog" : "dialog"}
        onOpenAutoFocus={(event) => {
          if (destructive && cancelRef.current) {
            event.preventDefault();
            cancelRef.current.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={cancelRef}
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            data-testid={cancelTestId ?? `${testId}-cancel`}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            loading={loading}
            onClick={onConfirm}
            data-testid={confirmTestId ?? `${testId}-confirm`}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
