"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback";
import { getDictionary } from "@/domain/i18n";

/** Root error boundary: generic localized copy, never the raw error text. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const { pageError, retry: retryLabel } = getDictionary().common;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <ErrorState
        title={pageError.title}
        message={pageError.message}
        onRetry={retry}
        retryLabel={retryLabel}
        data-testid="app-error"
      />
    </div>
  );
}
