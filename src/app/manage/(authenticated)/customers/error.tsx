"use client";

import { ErrorState } from "@/components/feedback";
import { getDictionary } from "@/domain/i18n";

export default function CustomersError({ retry }: { retry: () => void }) {
  const text = getDictionary().customers;
  return (
    <div className="mx-auto max-w-xl">
      <ErrorState
        title={text.title}
        message={text.loadFailed}
        onRetry={retry}
        retryLabel={text.retry}
        data-testid="customers-error"
      />
    </div>
  );
}
