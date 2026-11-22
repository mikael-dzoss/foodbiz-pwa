"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { useManagerLocale } from "@/components/i18n";

/**
 * Manager area error boundary: a failed page read shows a generic localized retry state inside
 * the manager shell. The server error text is never shown; only its digest, as a reference code.
 */
export default function ManageError({ error, retry }: { error: unknown; retry: () => void }) {
  const { pageError, retry: retryLabel } = useManagerLocale().dict.common;
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : undefined;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-3" data-testid="manage-error">
      <ErrorState
        headingLevel={1}
        title={pageError.title}
        message={pageError.message}
        onRetry={retry}
        retryLabel={retryLabel}
        data-testid="manage-error-state"
      />
      {digest && (
        <p className="text-muted-foreground text-center text-xs" data-testid="manage-error-ref">
          {pageError.reference}: {digest}
        </p>
      )}
      <div className="flex justify-center">
        <Button asChild variant="outline">
          <Link href="/manage" data-testid="manage-error-dashboard">
            {pageError.backToDashboard}
          </Link>
        </Button>
      </div>
    </div>
  );
}
