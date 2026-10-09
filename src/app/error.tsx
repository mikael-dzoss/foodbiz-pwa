"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring if configured
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <ErrorState
        title="Application error"
        message={error.message || "An unexpected error occurred while processing your request."}
        onRetry={reset}
        retryLabel="Retry"
      />
    </div>
  );
}
