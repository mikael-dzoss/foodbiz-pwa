"use client";

import { useActionState } from "react";
import { Loader2, Lock } from "lucide-react";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { INITIAL_ORDER_LOOKUP_STATE, type OrderLookupState } from "@/domain/order-lookup";
import { Alert, Button, Field, Input } from "@/components/ui";

export interface OrderLookupFormProps {
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  action: (prev: OrderLookupState, formData: FormData) => Promise<OrderLookupState>;
}

export function OrderLookupForm({ locale, dict, action }: OrderLookupFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ORDER_LOOKUP_STATE);
  const values = state.status === "error" ? state.values : undefined;
  const errorMessage =
    state.status !== "error"
      ? null
      : state.code === "RATE_LIMITED"
        ? dict.trackErrorRateLimited
        : state.code === "INVALID"
          ? dict.trackErrorInvalid
          : dict.trackErrorNotFound;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4" data-testid="order-lookup">
      <header>
        <h1 className="text-title-lg text-foreground">{dict.trackTitle}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{dict.trackIntro}</p>
      </header>

      <form
        action={formAction}
        noValidate
        className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-4"
        aria-describedby={errorMessage ? "order-lookup-error" : undefined}
      >
        <input type="hidden" name="locale" value={locale} />
        {/* Honeypot: hidden from people and assistive tech */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="order-lookup-website">{dict.honeypotLabel}</label>
          <input
            id="order-lookup-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <Field id="order-lookup-phone" label={dict.trackPhoneLabel}>
          <Input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            defaultValue={values?.phone}
            placeholder="06 12 34 56 78"
            aria-invalid={state.status === "error" || undefined}
            data-testid="order-lookup-phone"
            className="rounded-xl px-3.5 py-2.5"
          />
        </Field>

        <Field id="order-lookup-number" label={dict.trackOrderNumberLabel}>
          {(control) => (
            <div className="relative">
              <span
                className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-base"
                aria-hidden="true"
              >
                #
              </span>
              <Input
                {...control}
                name="orderNumber"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                required
                defaultValue={values?.orderNumber}
                placeholder="1042"
                aria-invalid={state.status === "error" || undefined}
                data-testid="order-lookup-number"
                className="rounded-xl py-2.5 pr-3.5 pl-8 tabular-nums"
              />
            </div>
          )}
        </Field>

        {errorMessage && (
          <Alert tone="error" id="order-lookup-error" data-testid="order-lookup-error">
            {errorMessage}
          </Alert>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full"
          data-testid="order-lookup-submit"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? dict.trackSubmitting : dict.trackSubmit}
        </Button>
      </form>

      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {dict.trackPrivacyNote}
      </p>
    </section>
  );
}
