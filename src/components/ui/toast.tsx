"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "error";

export interface ToastProps {
  id?: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  "data-testid"?: string;
}

interface ToastContextValue {
  showToast: (message: string, duration?: number, action?: ToastProps["action"]) => void;
  /** Error variant: destructive surface, icon, announced assertively. */
  showError: (message: string, duration?: number) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const push = React.useCallback(
    (
      message: string,
      duration: number,
      action: ToastProps["action"] | undefined,
      variant: ToastVariant,
    ) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastProps = { id, message, duration, action, variant };

      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  const showToast = React.useCallback(
    (message: string, duration = 4000, action?: ToastProps["action"]) =>
      push(message, duration, action, "default"),
    [push],
  );

  const showError = React.useCallback(
    (message: string, duration = 6000) => push(message, duration, undefined, "error"),
    [push],
  );

  const value = React.useMemo(() => ({ showToast, showError }), [showToast, showError]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-0 bottom-20 left-0 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-testid={toast.variant === "error" ? "toast-error" : "toast-item"}
            role={toast.variant === "error" ? "alert" : undefined}
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm shadow-lg",
              toast.variant === "error"
                ? "bg-destructive text-destructive-foreground"
                : "bg-foreground text-background",
              "w-full max-w-sm transition-all duration-200 motion-reduce:transition-none",
            )}
          >
            <span className="flex items-center gap-2">
              {toast.variant === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : null}
              {toast.message}
            </span>
            {toast.action && (
              <button
                type="button"
                onClick={toast.action.onClick}
                className="font-medium underline hover:opacity-80"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToastOptional(): ToastContextValue | null {
  return React.useContext(ToastContext) ?? null;
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
