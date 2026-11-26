"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ChevronLeft,
  Laptop,
  Sun,
  Moon,
  Smartphone,
  Download,
  Trash2,
  LogOut,
  ShieldCheck,
  Check,
} from "lucide-react";
import type { ManagerSession } from "@/domain/auth";
import type { SettingsDictionary, SupportedLocale } from "@/domain/i18n";
import { useTheme } from "@/components/theme";
import { SoonItem } from "@/components/feedback";
import { SegmentedControl, useToast } from "@/components/ui";
import { signOutAction } from "@/features/auth/actions";
import { switchLanguageAction } from "../actions";
import { APP_METADATA } from "@/config/app";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { Button } from "@/components/ui/button";
import { useManagerLocale } from "@/components/i18n";
import { interpolate } from "@/domain/i18n";
import { getDictionary } from "@/domain/i18n";

export interface AccountSettingsProps {
  session: ManagerSession;
  dict: SettingsDictionary;
  currentLocale: SupportedLocale;
}

export function AccountSettings({ session, dict, currentLocale }: AccountSettingsProps) {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const { dict: managerDict } = useManagerLocale();
  const x = managerDict.settingsExtra;
  const [locale, setLocale] = useState<SupportedLocale>(currentLocale);
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = (newLocale: SupportedLocale) => {
    if (newLocale === locale) return;
    setLocale(newLocale);
    startTransition(async () => {
      const res = await switchLanguageAction(newLocale);
      if (res.ok) {
        showToast(getDictionary(newLocale).settingsExtra.languageUpdated);
      } else {
        showToast(actionErrorMessage(res, currentLocale));
      }
    });
  };

  const managerInitial = session.user.name ? session.user.name[0].toUpperCase() : "M";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 pb-24" data-testid="account-settings">
      {/* Top Bar Navigation */}
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

      <div className="mb-6">
        <h1 className="text-title-lg text-foreground">{dict.account.title}</h1>
        <p className="text-body-sm text-muted-foreground mt-1">{dict.account.description}</p>
      </div>

      {/* Section 1: Manager Profile Card */}
      <div className="border-border bg-card mb-6 rounded-2xl border p-5 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="bg-primary-soft text-primary-soft-foreground flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold">
            {managerInitial}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-foreground text-base font-semibold">{session.user.name}</span>
              <span className="bg-primary-soft text-primary-soft-foreground rounded-full px-2 py-0.5 text-xs font-semibold uppercase">
                {session.user.role === "owner" ? x.roleOwner : x.roleManager}
              </span>
            </div>
            <p className="text-body-sm text-muted-foreground truncate">{session.user.email}</p>
            <p className="text-body-sm text-muted-foreground/80 mt-0.5 truncate">
              {session.business.name}
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Preferences */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.account.preferencesTitle}
        </h2>
        <div className="border-border bg-card divide-border space-y-4 rounded-2xl border p-4 shadow-2xs">
          {/* Language Selector */}
          <div>
            <p className="text-foreground mb-2 block text-sm font-semibold">
              {dict.account.languageLabel}
            </p>
            <SegmentedControl
              aria-label={dict.account.languageLabel}
              value={locale}
              onValueChange={handleLanguageChange}
              disabled={isPending}
              className="grid grid-cols-2"
              options={[
                {
                  value: "en",
                  "data-testid": "lang-en",
                  label: (
                    <>
                      {locale === "en" && <Check className="text-primary h-4 w-4" />}
                      <span>{x.languageEnglish}</span>
                    </>
                  ),
                },
                {
                  value: "fr",
                  "data-testid": "lang-fr",
                  label: (
                    <>
                      {locale === "fr" && <Check className="text-primary h-4 w-4" />}
                      <span>{x.languageFrench}</span>
                    </>
                  ),
                },
              ]}
            />
          </div>

          {/* Theme Selector */}
          <div>
            <p className="text-foreground mb-2 block text-sm font-semibold">
              {dict.account.themeLabel}
            </p>
            <SegmentedControl
              aria-label={dict.account.themeLabel}
              value={theme}
              onValueChange={setTheme}
              className="grid grid-cols-3"
              optionClassName="gap-1.5 text-xs sm:text-sm"
              options={[
                {
                  value: "system",
                  "data-testid": "theme-system",
                  label: (
                    <>
                      <Laptop className="h-4 w-4 shrink-0" />
                      <span>{dict.account.themeSystem}</span>
                    </>
                  ),
                },
                {
                  value: "light",
                  "data-testid": "theme-light",
                  label: (
                    <>
                      <Sun className="h-4 w-4 shrink-0" />
                      <span>{dict.account.themeLight}</span>
                    </>
                  ),
                },
                {
                  value: "dark",
                  "data-testid": "theme-dark",
                  label: (
                    <>
                      <Moon className="h-4 w-4 shrink-0" />
                      <span>{dict.account.themeDark}</span>
                    </>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Security & Data (Upcoming) */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.account.securityTitle}
        </h2>
        <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border shadow-2xs">
          <SoonItem
            featureKey="account.devices"
            leading={<Smartphone className="h-5 w-5" />}
            data-testid="soon-devices"
          />
          <SoonItem
            featureKey="account.export_data"
            leading={<Download className="h-5 w-5" />}
            data-testid="soon-export-data"
          />
          <SoonItem
            featureKey="account.delete"
            leading={<Trash2 className="text-destructive/80 h-5 w-5" />}
            data-testid="soon-delete-account"
          />
        </div>
      </div>

      {/* Section 4: Sign out */}
      <div className="border-border mt-8 border-t pt-6">
        <form action={signOutAction} data-testid="signout-form">
          <Button
            variant="unstyled"
            size="none"
            type="submit"
            className="border-destructive/30 text-destructive hover:bg-destructive/10 active:bg-destructive/20 focus-visible:ring-destructive flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <LogOut className="h-5 w-5" />
            <span>{dict.account.signOut}</span>
          </Button>
        </form>

        <div className="text-muted-foreground mt-4 flex flex-col items-center justify-center gap-1 text-center text-xs">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="text-primary h-4 w-4" />
            <span>
              {interpolate(x.posLine, {
                name: APP_METADATA.manager.name,
                version: dict.about.version,
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
