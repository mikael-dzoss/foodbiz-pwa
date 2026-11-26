"use client";

import { useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { APP_METADATA } from "@/config/app";
import {
  DEFAULT_LOCALE,
  getDictionary,
  type StorefrontDictionary,
  type SupportedLocale,
} from "@/domain/i18n";
import { usePwaInstall } from "@/lib/pwa/use-pwa-install";
import { InstallGuide } from "@/components/pwa";
import { Button, useToastOptional } from "@/components/ui";

export interface InstallAppCardProps {
  dict: StorefrontDictionary;
  businessName?: string;
  locale?: SupportedLocale;
}

/** Storefront "Install the app" entry (#100, #232): hidden when already running standalone. */
export function InstallAppCard({
  dict,
  businessName = APP_METADATA.storefront.defaultName,
  locale = DEFAULT_LOCALE,
}: InstallAppCardProps) {
  const { isStandalone, platform, promptInstall } = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const toast = useToastOptional();

  if (isStandalone) return null;

  const guideCopy = getDictionary(locale).installGuide;

  const handleNativeInstall = async () => {
    setInstalling(true);
    try {
      const outcome = await promptInstall();
      if (outcome === "accepted") {
        setGuideOpen(false);
        toast?.showToast(dict.installAppDone);
      } else if (outcome === "dismissed") {
        setGuideOpen(false);
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      data-testid="install-app-card"
      className="border-border bg-muted/40 mt-3 flex flex-col gap-3 rounded-2xl border p-3"
    >
      <div className="flex items-center gap-3">
        <span
          className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          aria-hidden="true"
        >
          <Smartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">{dict.installAppTitle}</p>
          <p className="text-muted-foreground text-xs">{dict.installAppSubtitle}</p>
        </div>
      </div>
      <Button
        type="button"
        onClick={() => setGuideOpen(true)}
        className="min-h-11 w-full gap-2"
        data-testid="install-app-button"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {dict.installAppButton}
      </Button>

      <InstallGuide
        open={guideOpen}
        onOpenChange={setGuideOpen}
        appName={businessName}
        platform={platform}
        copy={guideCopy}
        onInstall={handleNativeInstall}
        installing={installing}
        closeLabel={dict.dismiss}
        data-testid="storefront-install-guide"
      />
    </div>
  );
}
