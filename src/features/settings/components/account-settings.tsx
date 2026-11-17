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
import { cn } from "@/lib/utils";
import type { ManagerSession } from "@/domain/auth";
import type { SettingsDictionary, SupportedLocale } from "@/domain/i18n";
import { useTheme } from "@/components/theme";
import { SoonItem } from "@/components/feedback";
import { useToast } from "@/components/ui";
import { signOutAction } from "@/features/auth/actions";
import { switchLanguageAction } from "../actions";
import { APP_METADATA } from "@/config/app";

export interface AccountSettingsProps {
  session: ManagerSession;
  dict: SettingsDictionary;
  currentLocale: SupportedLocale;
}

export function AccountSettings({ session, dict, currentLocale }: AccountSettingsProps) {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const [locale, setLocale] = useState<SupportedLocale>(currentLocale);
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = (newLocale: SupportedLocale) => {
    if (newLocale === locale) return;
    setLocale(newLocale);
    startTransition(async () => {
      const res = await switchLanguageAction(newLocale);
      if (res.ok) {
        showToast(
          newLocale === "fr" ? "Langue mise à jour en Français" : "Language updated to English",
        );
      } else {
        showToast(res.message);
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
        <span className="text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
          M-61
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-display-sm text-foreground font-bold tracking-tight">
          {dict.account.title}
        </h1>
        <p className="text-body-sm text-muted-foreground mt-1">{dict.account.description}</p>
      </div>

      {/* Section 1: Manager Profile Card */}
      <div className="border-border bg-card mb-6 rounded-2xl border p-5 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="bg-primary-soft text-primary-soft-foreground flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold">
              {managerInitial}
            </div>
            {/* Google security badge indicator */}
            <div
              className="border-background bg-card text-primary absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border shadow-xs"
              title="Verified via Google Workspace"
            >
              <ShieldCheck className="text-primary h-3.5 w-3.5" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-foreground text-base font-semibold">{session.user.name}</span>
              <span className="bg-primary-soft text-primary-soft-foreground rounded-full px-2 py-0.5 text-xs font-semibold uppercase">
                {session.user.role === "owner" ? "Owner & Manager" : "Manager"}
              </span>
            </div>
            <p className="text-body-sm text-muted-foreground truncate">{session.user.email}</p>
            <p className="text-body-sm text-muted-foreground/80 mt-0.5 truncate">
              {session.business.name}
            </p>
          </div>
        </div>

        <div className="border-border mt-4 border-t pt-3">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ShieldCheck className="text-primary h-4 w-4 shrink-0" />
            <span>{dict.account.managedViaGoogle}</span>
          </div>
        </div>
      </div>

      {/* Section 2: Preferences */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
          {dict.account.preferencesTitle}
        </h2>
        <div className="border-border bg-card divide-border space-y-4 rounded-2xl border p-4 shadow-2xs">
          {/* Language Selector */}
          <div>
            <label className="text-foreground mb-2 block text-sm font-semibold">
              {dict.account.languageLabel}
            </label>
            <div
              role="radiogroup"
              aria-label={dict.account.languageLabel}
              className="bg-muted grid grid-cols-2 gap-1 rounded-xl p-1"
            >
              <button
                type="button"
                role="radio"
                aria-checked={locale === "en"}
                disabled={isPending}
                onClick={() => handleLanguageChange("en")}
                className={cn(
                  "focus-visible:ring-ring flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all focus-visible:ring-2 focus-visible:outline-none",
                  locale === "en"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid="lang-en"
              >
                {locale === "en" && <Check className="text-primary h-4 w-4" />}
                <span>English (EN)</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={locale === "fr"}
                disabled={isPending}
                onClick={() => handleLanguageChange("fr")}
                className={cn(
                  "focus-visible:ring-ring flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all focus-visible:ring-2 focus-visible:outline-none",
                  locale === "fr"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid="lang-fr"
              >
                {locale === "fr" && <Check className="text-primary h-4 w-4" />}
                <span>Français (FR)</span>
              </button>
            </div>
          </div>

          {/* Theme Selector */}
          <div>
            <label className="text-foreground mb-2 block text-sm font-semibold">
              {dict.account.themeLabel}
            </label>
            <div
              role="radiogroup"
              aria-label={dict.account.themeLabel}
              className="bg-muted grid grid-cols-3 gap-1 rounded-xl p-1"
            >
              <button
                type="button"
                role="radio"
                aria-checked={theme === "system"}
                onClick={() => setTheme("system")}
                className={cn(
                  "focus-visible:ring-ring flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all focus-visible:ring-2 focus-visible:outline-none sm:text-sm",
                  theme === "system"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid="theme-system"
              >
                <Laptop className="h-4 w-4 shrink-0" />
                <span>{dict.account.themeSystem}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={theme === "light"}
                onClick={() => setTheme("light")}
                className={cn(
                  "focus-visible:ring-ring flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all focus-visible:ring-2 focus-visible:outline-none sm:text-sm",
                  theme === "light"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid="theme-light"
              >
                <Sun className="h-4 w-4 shrink-0" />
                <span>{dict.account.themeLight}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={theme === "dark"}
                onClick={() => setTheme("dark")}
                className={cn(
                  "focus-visible:ring-ring flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all focus-visible:ring-2 focus-visible:outline-none sm:text-sm",
                  theme === "dark"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid="theme-dark"
              >
                <Moon className="h-4 w-4 shrink-0" />
                <span>{dict.account.themeDark}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Security & Data (Upcoming) */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
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
          <button
            type="submit"
            className="border-destructive/30 text-destructive hover:bg-destructive/10 active:bg-destructive/20 focus-visible:ring-destructive flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <LogOut className="h-5 w-5" />
            <span>{dict.account.signOut}</span>
          </button>
        </form>

        <div className="text-muted-foreground mt-4 flex flex-col items-center justify-center gap-1 text-center text-xs">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="text-primary h-4 w-4" />
            <span>
              {APP_METADATA.name} POS & Operations {dict.about.version}
            </span>
          </div>
          <span>Connected to European Region (Brussels)</span>
        </div>
      </div>
    </div>
  );
}
