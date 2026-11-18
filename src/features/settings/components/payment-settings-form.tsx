"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ChevronLeft, CreditCard, Banknote, Smartphone, QrCode, AlertCircle } from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import type { SettingsDictionary } from "@/domain/i18n";
import { SoonBadge } from "@/components/feedback";
import {
  ActionBar,
  Button,
  Field,
  Input,
  Switch,
  Textarea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@/components/ui";
import { updatePaymentSettingsAction } from "../actions";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { useManagerLocale } from "@/components/i18n";

export interface PaymentSettingsFormProps {
  settings: BusinessSettings;
  dict: SettingsDictionary;
  /** Set for members who are not the owner: the form is shown read-only with this explanation. */
  readOnlyReason?: string;
}

export function PaymentSettingsForm({ settings, dict, readOnlyReason }: PaymentSettingsFormProps) {
  const { showToast, showError } = useToast();
  const { locale: managerLocale, dict: managerDict } = useManagerLocale();
  const x = managerDict.settingsExtra;
  type SaveResult = Awaited<ReturnType<typeof updatePaymentSettingsAction>> | null;
  const [dismissed, setDismissed] = useState<SaveResult>(null);

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

  const handleDiscard = () => {
    setRevolutRevtag(settings.revolutRevtag ?? "");
    setWeroIdentifier(settings.weroIdentifier ?? "");
    setCash(settings.paymentMethods?.cash ?? true);
    setRevolut(settings.paymentMethods?.revolut ?? true);
    setWero(settings.paymentMethods?.wero ?? true);
    setPaymentInstructionsEn(settings.paymentInstructionsEn ?? "");
    setPaymentInstructionsFr(settings.paymentInstructionsFr ?? "");
    setDismissed(result);
    showToast(x.discarded);
  };

  const [result, formAction, isPending] = useActionState(async (): Promise<SaveResult> => {
    // Acceptance criterion: At least one payment option must be enabled
    if (!cash && !revolut && !wero) {
      showError(dict.payment.atLeastOneMethodError);
      return {
        ok: false,
        code: "VALIDATION",
        message: dict.payment.atLeastOneMethodError,
        fieldErrors: { paymentMethods: [dict.payment.atLeastOneMethodError] },
      };
    }

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

    if (res.ok) {
      showToast(dict.payment.saveSuccess);
    } else {
      showError(actionErrorMessage(res, managerLocale));
    }
    return res;
  }, null);
  const errors: Record<string, string[]> =
    result && result !== dismissed && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form
      action={formAction}
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
        <h1 className="text-title-lg text-foreground">{dict.payment.title}</h1>
        <p className="text-body-sm text-muted-foreground mt-1">{dict.payment.description}</p>
      </div>

      <fieldset
        disabled={Boolean(readOnlyReason)}
        aria-describedby={readOnlyReason ? "payment-owner-only-notice" : undefined}
        className="min-w-0 border-0 p-0"
      >
        {/* Section 1: Direct Transfer Identifiers */}
        <div className="mb-6">
          <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
            {dict.payment.identifiersSection}
          </h2>
          <div className="border-border bg-card space-y-4 rounded-2xl border p-4 shadow-2xs">
            {/* Revolut Revtag */}
            <Field
              id="revolut-revtag-input"
              label={dict.payment.revolutLabel}
              hint={dict.payment.revolutHelper}
              hintPosition="above"
            >
              {(control) => (
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-mono text-sm">
                    @
                  </span>
                  <Input
                    {...control}
                    data-testid="input-revolut-revtag"
                    type="text"
                    value={revolutRevtag.replace(/^@/, "")}
                    onChange={(e) => setRevolutRevtag(e.target.value)}
                    placeholder={dict.payment.revolutPlaceholder.replace(/^@/, "")}
                    className="h-11 rounded-xl py-2 pr-3 pl-8 text-sm"
                  />
                </div>
              )}
            </Field>

            {/* Wero Identifier */}
            <Field
              id="wero-identifier-input"
              label={dict.payment.weroLabel}
              hint={dict.payment.weroHelper}
              hintPosition="above"
              className="border-border border-t pt-3"
            >
              <Input
                data-testid="input-wero-identifier"
                type="text"
                value={weroIdentifier}
                onChange={(e) => setWeroIdentifier(e.target.value)}
                placeholder={dict.payment.weroPlaceholder}
                className="h-11 rounded-xl py-2 text-sm"
              />
            </Field>
          </div>
        </div>

        {/* Section 2: Handover Payment Methods */}
        <div className="mb-6">
          <h2 className="text-label-sm text-muted-foreground mb-1 px-1 tracking-wider uppercase">
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
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.payment.instructionsSection}
        </h2>
        <div className="border-border bg-card rounded-2xl border p-4 shadow-2xs">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "en" | "fr")}>
            <TabsList
              aria-label={dict.payment.instructionsSection}
              className="bg-muted mb-3 h-auto rounded-lg p-1 text-xs"
            >
              <TabsTrigger
                value="en"
                data-testid="tab-instructions-en"
                className="data-[state=active]:bg-card data-[state=active]:text-foreground min-h-9 rounded-md px-3 py-1 text-xs font-medium data-[state=active]:font-semibold data-[state=active]:shadow-2xs"
              >
                {x.languageEnglish}
              </TabsTrigger>
              <TabsTrigger
                value="fr"
                data-testid="tab-instructions-fr"
                className="min-h-9 rounded-md px-3 py-1 text-xs font-medium data-[state=active]:font-semibold data-[state=active]:shadow-2xs"
              >
                {x.languageFrench}
              </TabsTrigger>
            </TabsList>

            {/* The EN/FR tabs above stay usable when read-only; only the inputs are disabled. */}
            <fieldset
              disabled={Boolean(readOnlyReason)}
              aria-describedby={readOnlyReason ? "payment-owner-only-notice" : undefined}
              className="min-w-0 border-0 p-0"
            >
              <TabsContent value="en" className="mt-0">
                <Field
                  id="instructions-en"
                  label={dict.payment.instructionsEnLabel}
                  hint={dict.payment.instructionsHelper}
                  hintPosition="above"
                >
                  <Textarea
                    data-testid="textarea-instructions-en"
                    rows={3}
                    value={paymentInstructionsEn}
                    onChange={(e) => setPaymentInstructionsEn(e.target.value)}
                    placeholder={x.instructionsPlaceholderEn}
                    className="rounded-xl py-2 text-sm"
                  />
                </Field>
              </TabsContent>
              <TabsContent value="fr" className="mt-0">
                <Field
                  id="instructions-fr"
                  label={dict.payment.instructionsFrLabel}
                  hint={dict.payment.instructionsHelper}
                  hintPosition="above"
                >
                  <Textarea
                    data-testid="textarea-instructions-fr"
                    rows={3}
                    value={paymentInstructionsFr}
                    onChange={(e) => setPaymentInstructionsFr(e.target.value)}
                    placeholder={x.instructionsPlaceholderFr}
                    className="rounded-xl py-2 text-sm"
                  />
                </Field>
              </TabsContent>
            </fieldset>
          </Tabs>
        </div>
      </div>

      {/* Section 4: Upcoming Capabilities */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.payment.soonSection}
        </h2>
        <div className="border-border bg-card rounded-2xl border p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  {x.soon.stripeTitle}
                </span>
                <span className="text-muted-foreground block text-xs">{x.soon.stripeDesc}</span>
              </div>
            </div>
            {/* TODO(payment): wire Stripe Connect onboarding (#72) */}
            <SoonBadge />
          </div>
        </div>
      </div>

      {/* Sticky Save/Discard bar: above the manager bottom nav, static on desktop */}
      <ActionBar data-testid="settings-action-bar">
        <Button
          type="button"
          variant="outline"
          onClick={handleDiscard}
          disabled={isPending}
          data-testid="discard-button"
          className="flex-1 rounded-xl"
        >
          {dict.payment.discardButton}
        </Button>
        <Button
          type="submit"
          disabled={isPending || Boolean(readOnlyReason)}
          loading={isPending}
          data-testid="save-payment-button"
          className="flex-1 rounded-xl"
        >
          {isPending ? dict.saving : dict.payment.saveButton}
        </Button>
      </ActionBar>
    </form>
  );
}
