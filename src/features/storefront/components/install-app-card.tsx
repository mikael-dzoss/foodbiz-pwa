"use client";

import { useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import type { StorefrontDictionary } from "@/domain/i18n";
import { usePwaInstall } from "@/lib/pwa/use-pwa-install";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useToastOptional } from "@/components/ui";

/** Storefront "Install the app" entry (#232): hidden when running standalone or not installable. */
export function InstallAppCard({ dict }: { dict: StorefrontDictionary }) {
  const { isStandalone, canPrompt, isIos, promptInstall } = usePwaInstall();
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const toast = useToastOptional();

  if (isStandalone || (!canPrompt && !isIos)) return null;

  const handleInstall = async () => {
    if (canPrompt) {
      if ((await promptInstall()) === "accepted") toast?.showToast(dict.installAppDone);
      return;
    }
    setIosHelpOpen(true);
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
        onClick={handleInstall}
        className="min-h-11 w-full"
        data-testid="install-app-button"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {dict.installAppButton}
      </Button>

      <Dialog open={iosHelpOpen} onOpenChange={setIosHelpOpen}>
        <DialogContent
          data-testid="install-ios-dialog"
          className="animate-pop-in w-screen-gutter max-w-sm rounded-2xl p-5"
        >
          <DialogTitle className="pr-10">{dict.installIosTitle}</DialogTitle>
          <DialogDescription className="sr-only">{dict.installAppSubtitle}</DialogDescription>
          <ol className="text-foreground flex list-decimal flex-col gap-2 pl-5 text-sm">
            <li>
              {dict.installIosStep1}{" "}
              <Share className="text-primary inline h-4 w-4 align-text-bottom" aria-hidden="true" />
            </li>
            <li>{dict.installIosStep2}</li>
            <li>{dict.installIosStep3}</li>
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
