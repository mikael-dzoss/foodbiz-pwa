"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { OrderConfirmationDictionary } from "@/domain/i18n";

export function CopyPaymentRecipient({
  recipient,
  dict,
}: {
  recipient: string;
  dict: OrderConfirmationDictionary;
}) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(recipient);
      setMessage(dict.copied);
    } catch {
      setMessage(dict.copyFailed);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={copy}
        data-testid="copy-payment-recipient"
      >
        {dict.copy}
      </Button>
      <p role="status" className="text-muted-foreground text-sm">
        {message}
      </p>
    </div>
  );
}
