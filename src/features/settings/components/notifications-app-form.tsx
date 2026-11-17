"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Bell,
  Volume2,
  Smartphone,
  Download,
  Info,
  Mail,
  Send,
  Users,
  CheckCircle2,
} from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import type { SettingsDictionary } from "@/domain/i18n";
import { SoonBadge } from "@/components/feedback";
import { ActionBar, Button, Switch, useToast } from "@/components/ui";
import { updateNotificationSettingsAction } from "../actions";
import { usePwaInstall } from "@/lib/pwa/use-pwa-install";
import { actionErrorMessage } from "@/lib/actions/error-message";

export interface NotificationsAppFormProps {
  settings: BusinessSettings;
  dict: SettingsDictionary;
}

export function NotificationsAppForm({ settings, dict }: NotificationsAppFormProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  // 1. Alert toggles
  const [inAppAlerts, setInAppAlerts] = useState(settings.inAppAlerts ?? true);
  const [soundAlerts, setSoundAlerts] = useState(settings.soundAlerts ?? true);

  // 2. PWA installation state (shared hook)
  const { isStandalone, canPrompt, promptInstall } = usePwaInstall();

  const handleInstallClick = async () => {
    if (canPrompt) {
      if ((await promptInstall()) === "accepted") {
        showToast("FoodBiz Manager PWA installed successfully");
      }
    } else if (isStandalone) {
      showToast("FoodBiz is already installed on this device");
    } else {
      showToast("To install, tap Share or Menu in your browser, then 'Add to Home Screen'");
    }
  };

  const handleDiscard = () => {
    setInAppAlerts(settings.inAppAlerts ?? true);
    setSoundAlerts(settings.soundAlerts ?? true);
    showToast("Changes discarded");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const res = await updateNotificationSettingsAction({
        notifications: inAppAlerts,
        inAppAlerts,
        soundAlerts,
      });

      if (res.ok) {
        showToast(dict.notifications.saveSuccess);
      } else {
        showToast(actionErrorMessage(res));
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-md px-4 py-6 pb-32"
      data-testid="notifications-app-form"
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
          M-67
        </span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-title-lg text-foreground font-bold tracking-tight">
          {dict.notifications.title}
        </h1>
        <p className="text-body-sm text-muted-foreground mt-1">{dict.notifications.description}</p>
      </div>

      {/* Section 1: In-App Alerts & Sounds */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.notifications.alertsSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y rounded-2xl border shadow-2xs">
          {/* In-app alerts */}
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {dict.notifications.inAppAlertsLabel}
                </span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {dict.notifications.inAppAlertsDesc}
                </span>
              </div>
            </div>
            <Switch
              checked={inAppAlerts}
              onCheckedChange={setInAppAlerts}
              data-testid="switch-in-app-alerts"
              aria-label={dict.notifications.inAppAlertsLabel}
            />
          </div>

          {/* Sound alerts */}
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Volume2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {dict.notifications.soundAlertsLabel}
                </span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {dict.notifications.soundAlertsDesc}
                </span>
              </div>
            </div>
            <Switch
              checked={soundAlerts}
              onCheckedChange={setSoundAlerts}
              data-testid="switch-sound-alerts"
              aria-label={dict.notifications.soundAlertsLabel}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Application & PWA Installation */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.notifications.appSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y rounded-2xl border shadow-2xs">
          {/* Install App Card */}
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-semibold">
                      {dict.notifications.installAppTitle}
                    </span>
                    {isStandalone && (
                      <span
                        data-testid="badge-installed"
                        className="bg-primary-soft text-primary-soft-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{dict.notifications.installedBadge}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-body-sm text-muted-foreground mt-0.5">
                    {dict.notifications.installAppDesc}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleInstallClick}
              data-testid="button-install-pwa"
              className="bg-muted hover:bg-muted/80 active:bg-muted/90 text-foreground focus-visible:ring-ring mt-3.5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Download className="h-4 w-4" />
              <span>
                {isStandalone ? "Reinstall / Check Status" : dict.notifications.installAppButton}
              </span>
            </button>
          </div>

          {/* Link to About & Support */}
          <Link
            href="/manage/settings/about"
            data-testid="link-to-about"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex items-center justify-between p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <Info className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-semibold">
                  {dict.notifications.aboutLinkText}
                </span>
                <span className="text-muted-foreground block text-xs">
                  Version {dict.about.version} • Legal terms, support contacts & license
                </span>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground/60 h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Section 3: Upcoming Capabilities */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.notifications.soonSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y rounded-2xl border opacity-75 shadow-2xs">
          {/* Email notifications */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  Email Order Confirmations
                </span>
                <span className="text-muted-foreground block text-xs">
                  Instant email copies sent on customer checkout
                </span>
              </div>
            </div>
            {/* TODO(notifications): wire SendGrid / Resend email sender (#74) */}
            <SoonBadge />
          </div>

          {/* Push notifications */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <Send className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  Mobile Push Notifications
                </span>
                <span className="text-muted-foreground block text-xs">
                  Background Web Push even when the browser is closed
                </span>
              </div>
            </div>
            {/* TODO(notifications): wire Web Push service worker subscriptions (#74) */}
            <SoonBadge />
          </div>

          {/* Team roles and invites */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  Invite Staff & Team Permissions
                </span>
                <span className="text-muted-foreground block text-xs">
                  Cashier, kitchen display, and manager access controls
                </span>
              </div>
            </div>
            {/* TODO(team): wire staff invitations and RBAC (#74) */}
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
          {dict.notifications.discardButton}
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          loading={isPending}
          data-testid="save-notifications-button"
          className="flex-1 rounded-xl"
        >
          {isPending ? dict.saving : dict.notifications.saveButton}
        </Button>
      </ActionBar>
    </form>
  );
}
