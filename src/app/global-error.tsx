"use client";
import "./globals.css";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors in the root layout. It replaces the layout, so it renders its
 * own document and cannot rely on providers; the global stylesheet is imported for the tokens.
 * Never shows the error text, only the digest as a reference.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : undefined;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <main role="alert" data-testid="global-error">
          <h1 className="text-title-lg">Something went wrong</h1>
          <p className="text-body-sm text-muted-foreground mt-2">
            We could not load the app. Please try again.
          </p>
          {digest && (
            <p className="text-muted-foreground mt-2 text-xs" data-testid="global-error-ref">
              Reference: {digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => retry()}
            className="bg-primary text-primary-foreground focus-visible:ring-ring mt-4 inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
            data-testid="global-error-retry"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
