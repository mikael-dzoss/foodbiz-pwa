"use client";

import Link from "next/link";
import {
  User,
  Store,
  ShoppingBag,
  CreditCard,
  Package,
  Bell,
  Users,
  Info,
  ChevronRight,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import type { ManagerSession } from "@/domain/auth";
import type { SettingsDictionary } from "@/domain/i18n";
import { SoonItem } from "@/components/feedback";
import { signOutAction } from "@/features/auth/actions";
import { APP_METADATA } from "@/config/app";
import { Button } from "@/components/ui/button";
import { useManagerLocale } from "@/components/i18n";
import { interpolate } from "@/domain/i18n";

export interface SettingsHubProps {
  session: ManagerSession;
  dict: SettingsDictionary;
}

export function SettingsHub({ session, dict }: SettingsHubProps) {
  const { dict: managerDict } = useManagerLocale();
  const x = managerDict.settingsExtra;
  const managerInitial = session.user.name ? session.user.name[0].toUpperCase() : "M";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 pb-24" data-testid="settings-hub">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-title-lg text-foreground">{dict.title}</h1>
        <p className="text-body-sm text-muted-foreground mt-1">{dict.subtitle}</p>
      </div>

      {/* Manager Profile Snippet Card */}
      <Link
        href="/manage/settings/account"
        data-testid="profile-snippet-card"
        className="border-border bg-card hover:bg-muted/50 active:bg-muted focus-visible:ring-ring mb-6 flex items-center justify-between rounded-2xl border p-4 shadow-2xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="bg-primary-soft text-primary-soft-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold">
            {managerInitial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-foreground truncate font-semibold">{session.user.name}</span>
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-semibold uppercase">
                {session.user.role}
              </span>
            </div>
            <p className="text-body-sm text-muted-foreground truncate">{session.user.email}</p>
          </div>
        </div>
        <ChevronRight className="text-muted-foreground/60 h-5 w-5 shrink-0" />
      </Link>

      {/* 1. Core Settings */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.coreSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y rounded-2xl border shadow-2xs">
          {/* Account */}
          <Link
            href="/manage/settings/account"
            data-testid="link-account-settings"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 items-center justify-between gap-3 p-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {dict.account.title}
                </span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {dict.account.description}
                </span>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground/60 h-5 w-5 shrink-0" />
          </Link>

          {/* Business Profile */}
          <Link
            href="/manage/settings/business"
            data-testid="link-business-settings"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 items-center justify-between gap-3 p-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {dict.business.title}
                </span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {dict.business.description}
                </span>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground/60 h-5 w-5 shrink-0" />
          </Link>
        </div>
      </div>

      {/* 2. Operations */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.operationsSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y rounded-2xl border shadow-2xs">
          {/* Ordering */}
          <Link
            href="/manage/settings/ordering"
            data-testid="link-ordering-settings"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 items-center justify-between gap-3 p-4 transition-colors first:rounded-t-2xl focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {dict.ordering.title}
                </span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {dict.ordering.description}
                </span>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground/60 h-5 w-5 shrink-0" />
          </Link>

          {/* Payment */}
          <Link
            href="/manage/settings/payment"
            data-testid="link-payment-settings"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 items-center justify-between gap-3 p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {dict.payment.title}
                </span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {dict.payment.description}
                </span>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground/60 h-5 w-5 shrink-0" />
          </Link>

          {/* Inventory & Finance */}
          <Link
            href="/manage/settings/inventory-finance"
            data-testid="link-inventory-settings"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 items-center justify-between gap-3 p-4 transition-colors last:rounded-b-2xl focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Package className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {dict.inventoryFinance.title}
                </span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {dict.inventoryFinance.description}
                </span>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground/60 h-5 w-5 shrink-0" />
          </Link>
        </div>
      </div>

      {/* 3. System & App */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.systemSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border shadow-2xs">
          {/* Notifications & App */}
          <Link
            href="/manage/settings/notifications"
            data-testid="link-notifications-settings"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 items-center justify-between gap-3 p-4 transition-colors first:rounded-t-2xl focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {dict.notifications.title}
                </span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {dict.notifications.description}
                </span>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground/60 h-5 w-5 shrink-0" />
          </Link>

          {/* Team Permissions (Upcoming) */}
          <SoonItem
            featureKey="settings.team"
            leading={<Users className="h-5 w-5" />}
            data-testid="soon-team"
          />

          {/* About */}
          <Link
            href="/manage/settings/about"
            data-testid="link-about"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 items-center justify-between gap-3 p-4 transition-colors last:rounded-b-2xl focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Info className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm font-semibold">{dict.about.title}</span>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                    {dict.about.version}
                  </span>
                </div>
                <span className="text-body-sm text-muted-foreground truncate">
                  {dict.about.legal}
                </span>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground/60 h-5 w-5 shrink-0" />
          </Link>
        </div>
      </div>

      {/* 4. Session Action */}
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

        {/* Footer Meta */}
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
