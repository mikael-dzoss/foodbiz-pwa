"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ToastProps {
  id?: string;
  message: string;
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
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const showToast = React.useCallback(
    (message: string, duration = 4000, action?: ToastProps["action"]) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastProps = { id, message, duration, action };

      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-0 bottom-20 left-0 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-testid="toast-item"
            className={cn(
              "bg-foreground text-background pointer-events-auto flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm shadow-lg",
              "w-full max-w-sm transition-all duration-200 motion-reduce:transition-none",
            )}
          >
            <span>{toast.message}</span>
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

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
