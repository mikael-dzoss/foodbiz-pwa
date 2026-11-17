"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ChevronLeft,
  CreditCard,
  Banknote,
  Smartphone,
  QrCode,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import type { SettingsDictionary } from "@/domain/i18n";
import { SoonBadge } from "@/components/feedback";
import { Switch, useToast } from "@/components/ui";
import { updatePaymentSettingsAction } from "../actions";

export interface PaymentSettingsFormProps {
  settings: BusinessSettings;
  dict: SettingsDictionary;
  /** Set for members who are not the owner: the form is shown read-only with this explanation. */
  readOnlyReason?: string;
}

export function PaymentSettingsForm({ settings, dict, readOnlyReason }: PaymentSettingsFormProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  // 1. Direct transfer identifiers
  const [revolutRevtag, setRevolutRevtag] = useState(settings.revolutRevtag ?? "");
  const [weroIdentifier, setWeroIdentifier] = useState(settings.weroIdentifier ?? "");

  // 2. Handover payment toggles
  const [cash, setCash] = useState(settings.paymentMethods?.cash ?? true);
  const [revolut, setRevolut] = useState(settings.paymentMethods?.revolut ?? true);
  const [wero, setWero] = useState(settings.paymentMethods?.wero ?? true);

  // 3. Multilingual payment instructions
  const [paymentInstructionsEn, setPaymentInstructionsEn] = useState(
    settings.paymentInstructionsEn ?? "",
  );
  const [paymentInstructionsFr, setPaymentInstructionsFr] = useState(
    settings.paymentInstructionsFr ?? "",
  );

  // Active instructions tab (EN vs FR)
  const [activeTab, setActiveTab] = useState<"en" | "fr">("en");

  // Errors
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const handleDiscard = () => {
    setRevolutRevtag(settings.revolutRevtag ?? "");
    setWeroIdentifier(settings.weroIdentifier ?? "");
    setCash(settings.paymentMethods?.cash ?? true);
    setRevolut(settings.paymentMethods?.revolut ?? true);
    setWero(settings.paymentMethods?.wero ?? true);
    setPaymentInstructionsEn(settings.paymentInstructionsEn ?? "");
    setPaymentInstructionsFr(settings.paymentInstructionsFr ?? "");
    setErrors({});
    showToast("Changes discarded");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Acceptance criterion: At least one payment option must be enabled
    if (!cash && !revolut && !wero) {
      setErrors({
        paymentMethods: [dict.payment.atLeastOneMethodError],
      });
      showToast(dict.payment.atLeastOneMethodError);
      return;
    }

    startTransition(async () => {
      const res = await updatePaymentSettingsAction({
        revolutRevtag: revolutRevtag.trim(),
        weroIdentifier: weroIdentifier.trim(),
        paymentMethods: {
          cash,
          revolut,
          wero,
        },
        paymentInstructionsEn: paymentInstructionsEn.trim(),
        paymentInstructionsFr: paymentInstructionsFr.trim(),
      });

      if (res.success) {
        showToast(dict.payment.saveSuccess);
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
        }
        showToast(res.error || "Failed to save payment settings");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-md px-4 py-6 pb-32"
      data-testid="payment-settings-form"
    >
      {/* Top Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/manage/settings"
          data-testid="back-to-settings"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>{dict.title}</span>
        </Link>
        <span className="text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
          M-64
        </span>
      </div>

      {/* Owner-only explanation: the form below is read-only for other members */}
      {readOnlyReason && (
        <p
          role="note"
          id="payment-owner-only-notice"
          className="border-border bg-muted text-muted-foreground mb-6 rounded-xl border px-4 py-3 text-sm"
          data-testid="payment-owner-only-notice"
        >
          {readOnlyReason}
        </p>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-display-sm text-foreground font-bold tracking-tight">
          {dict.payment.title}
        </h1>
        <p className="text-body-sm text-muted-foreground mt-1">{dict.payment.description}</p>
      </div>

      <fieldset
        disabled={Boolean(readOnlyReason)}
        aria-describedby={readOnlyReason ? "payment-owner-only-notice" : undefined}
        className="min-w-0 border-0 p-0"
      >
        {/* Section 1: Direct Transfer Identifiers */}
        <div className="mb-6">
          <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
            {dict.payment.identifiersSection}
          </h2>
          <div className="border-border bg-card space-y-4 rounded-2xl border p-4 shadow-2xs">
            {/* Revolut Revtag */}
            <div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="revolut-revtag-input"
                  className="text-foreground text-sm font-semibold"
                >
                  {dict.payment.revolutLabel}
                </label>
              </div>
              <p className="text-body-sm text-muted-foreground mt-0.5">
                {dict.payment.revolutHelper}
              </p>
              <div className="relative mt-2">
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-mono text-sm">
                  @
                </span>
                <input
                  id="revolut-revtag-input"
                  data-testid="input-revolut-revtag"
                  type="text"
                  value={revolutRevtag.replace(/^@/, "")}
                  onChange={(e) => setRevolutRevtag(e.target.value)}
                  placeholder={dict.payment.revolutPlaceholder.replace(/^@/, "")}
                  className="border-input bg-background text-foreground focus-visible:ring-ring w-full rounded-xl border py-2 pr-3 pl-8 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                />
              </div>
            </div>

            {/* Wero Identifier */}
            <div className="border-border border-t pt-3">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="wero-identifier-input"
                  className="text-foreground text-sm font-semibold"
                >
                  {dict.payment.weroLabel}
                </label>
              </div>
              <p className="text-body-sm text-muted-foreground mt-0.5">{dict.payment.weroHelper}</p>
              <input
                id="wero-identifier-input"
                data-testid="input-wero-identifier"
                type="text"
                value={weroIdentifier}
                onChange={(e) => setWeroIdentifier(e.target.value)}
                placeholder={dict.payment.weroPlaceholder}
                className="border-input bg-background text-foreground focus-visible:ring-ring mt-2 w-full rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Handover Payment Methods */}
        <div className="mb-6">
          <h2 className="text-label-sm text-muted-foreground mb-1 px-1 font-semibold tracking-wider uppercase">
            {dict.payment.methodsSection}
          </h2>
          <p className="text-body-sm text-muted-foreground mb-2 px-1">
            {dict.payment.methodsHelper}
          </p>
          <div className="border-border bg-card divide-border divide-y rounded-2xl border shadow-2xs">
            {/* Cash */}
            <div className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <Banknote className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-foreground block text-sm font-semibold">
                    {dict.payment.cashLabel}
                  </span>
                  <span className="text-body-sm text-muted-foreground block truncate">
                    {dict.payment.cashDesc}
                  </span>
                </div>
              </div>
              <Switch
                checked={cash}
                onCheckedChange={setCash}
                data-testid="switch-payment-cash"
                aria-label={dict.payment.cashLabel}
              />
            </div>

            {/* Revolut */}
            <div className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-foreground block text-sm font-semibold">
                    {dict.payment.revolutMethodLabel}
                  </span>
                  <span className="text-body-sm text-muted-foreground block truncate">
                    {dict.payment.revolutMethodDesc}
                  </span>
                </div>
              </div>
              <Switch
                checked={revolut}
                onCheckedChange={setRevolut}
                data-testid="switch-payment-revolut"
                aria-label={dict.payment.revolutMethodLabel}
              />
            </div>

            {/* Wero */}
            <div className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <QrCode className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-foreground block text-sm font-semibold">
                    {dict.payment.weroMethodLabel}
                  </span>
                  <span className="text-body-sm text-muted-foreground block truncate">
                    {dict.payment.weroMethodDesc}
                  </span>
                </div>
              </div>
              <Switch
                checked={wero}
                onCheckedChange={setWero}
                data-testid="switch-payment-wero"
                aria-label={dict.payment.weroMethodLabel}
              />
            </div>
          </div>

          {errors.paymentMethods && (
            <p
              data-testid="error-payment-methods"
              className="text-destructive mt-1.5 flex items-center gap-1 px-1 text-xs font-medium"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errors.paymentMethods[0]}</span>
            </p>
          )}
        </div>
      </fieldset>

      {/* Section 3: Payment Instructions (Multilingual) */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
          {dict.payment.instructionsSection}
        </h2>
        <div className="border-border bg-card rounded-2xl border p-4 shadow-2xs">
          <div className="mb-3 flex items-center justify-between">
            <div className="bg-muted inline-flex rounded-lg p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("en")}
                data-testid="tab-instructions-en"
                className={`rounded-md px-3 py-1 transition-colors ${
                  activeTab === "en"
                    ? "bg-card text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("fr")}
                data-testid="tab-instructions-fr"
                className={`rounded-md px-3 py-1 transition-colors ${
                  activeTab === "fr"
                    ? "bg-card text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Français
              </button>
            </div>
          </div>

          {/* The EN/FR tabs above stay usable when read-only; only the inputs are disabled. */}
          <fieldset
            disabled={Boolean(readOnlyReason)}
            aria-describedby={readOnlyReason ? "payment-owner-only-notice" : undefined}
            className="min-w-0 border-0 p-0"
          >
            {activeTab === "en" ? (
              <div>
                <label
                  htmlFor="instructions-en"
                  className="text-foreground block text-sm font-semibold"
                >
                  {dict.payment.instructionsEnLabel}
                </label>
                <p className="text-body-sm text-muted-foreground mt-0.5">
                  {dict.payment.instructionsHelper}
                </p>
                <textarea
                  id="instructions-en"
                  data-testid="textarea-instructions-en"
                  rows={3}
                  value={paymentInstructionsEn}
                  onChange={(e) => setPaymentInstructionsEn(e.target.value)}
                  placeholder="e.g. Please show your order confirmation on pickup. Revolut or cash accepted."
                  className="border-input bg-background text-foreground focus-visible:ring-ring mt-2 w-full rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                />
              </div>
            ) : (
              <div>
                <label
                  htmlFor="instructions-fr"
                  className="text-foreground block text-sm font-semibold"
                >
                  {dict.payment.instructionsFrLabel}
                </label>
                <p className="text-body-sm text-muted-foreground mt-0.5">
                  {dict.payment.instructionsHelper}
                </p>
                <textarea
                  id="instructions-fr"
                  data-testid="textarea-instructions-fr"
                  rows={3}
                  value={paymentInstructionsFr}
                  onChange={(e) => setPaymentInstructionsFr(e.target.value)}
                  placeholder="ex. Merci de présenter votre confirmation au comptoir. Espèces ou Revolut acceptés."
                  className="border-input bg-background text-foreground focus-visible:ring-ring mt-2 w-full rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                />
              </div>
            )}
          </fieldset>
        </div>
      </div>

      {/* Section 4: Upcoming Capabilities */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
          {dict.payment.soonSection}
        </h2>
        <div className="border-border bg-card rounded-2xl border p-4 opacity-75 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  Online Card Payments (Stripe & Apple Pay)
                </span>
                <span className="text-muted-foreground block text-xs">
                  Automated card authorization directly on web storefront
                </span>
              </div>
            </div>
            {/* TODO(payment): wire Stripe Connect onboarding (#72) */}
            <SoonBadge />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={isPending}
            data-testid="discard-button"
            className="border-border hover:bg-muted active:bg-muted/80 text-foreground focus-visible:ring-ring flex min-h-12 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {dict.payment.discardButton}
          </button>
          <button
            type="submit"
            disabled={isPending || Boolean(readOnlyReason)}
            data-testid="save-payment-button"
            className="bg-primary hover:bg-primary/90 active:bg-primary/95 text-primary-foreground focus-visible:ring-ring flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-2xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{dict.payment.saveButton}</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
