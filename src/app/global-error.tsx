"use client";
import "./globals.css";

import { useEffect } from "react";
import { DEFAULT_LOCALE, getDictionary } from "@/domain/i18n";

/**
 * Last-resort boundary for errors in the root layout. It replaces the layout, so it renders its
 * own document and cannot rely on providers; the global stylesheet is imported for the tokens.
 * Never shows the error text, only the digest as a reference.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  // The locale is unknown here (the root layout failed): default language.
  const { pageError, tryAgain } = getDictionary(DEFAULT_LOCALE).common;
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : undefined;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={DEFAULT_LOCALE}>
      <body className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <main role="alert" data-testid="global-error">
          <h1 className="text-title-lg">{pageError.title}</h1>
          <p className="text-body-sm text-muted-foreground mt-2">{pageError.message}</p>
          {digest && (
            <p className="text-muted-foreground mt-2 text-xs" data-testid="global-error-ref">
              {pageError.reference}: {digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => retry()}
            className="bg-primary text-primary-foreground focus-visible:ring-ring mt-4 inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
            data-testid="global-error-retry"
          >
            {tryAgain}
          </button>
        </main>
      </body>
    </html>
  );
}
