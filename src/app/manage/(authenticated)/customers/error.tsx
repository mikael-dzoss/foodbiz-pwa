"use client";

import { ErrorState } from "@/components/feedback";
import { useManagerLocale } from "@/components/i18n";

export default function CustomersError({ retry }: { retry: () => void }) {
  const text = useManagerLocale().dict.customers;
  return (
    <div className="mx-auto max-w-xl">
      <ErrorState
        headingLevel={1}
        title={text.title}
        message={text.loadFailed}
        onRetry={retry}
        retryLabel={text.retry}
        data-testid="customers-error"
      />
    </div>
  );
}
