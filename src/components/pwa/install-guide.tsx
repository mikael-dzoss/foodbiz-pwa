"use client";

import type { ReactNode } from "react";
import { Download, EllipsisVertical, Monitor, Share, Smartphone } from "lucide-react";
import { interpolate, type InstallGuideDictionary } from "@/domain/i18n";
import type { InstallPlatform } from "@/lib/pwa/platform";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";

export interface InstallGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the app being installed (shop name on storefront, "FoodBiz Manager" on /manage). */
  appName: string;
  /** Detected install path; renders nothing when already `"standalone"`. */
  platform: InstallPlatform;
  /** Localised guide copy (EN or FR from `@/domain/i18n`). */
  copy: InstallGuideDictionary;
  /** Triggered by the primary Install button when `platform === "native-prompt"`. */
  onInstall?: () => void | Promise<void>;
  /** Disables and shows a spinner on the native Install button while the browser prompt runs. */
  installing?: boolean;
  /** Accessible name of the close icon button. Defaults to `copy.close`. */
  closeLabel?: string;
  /** Unique test id prefix for the dialog and its inner controls. */
  "data-testid"?: string;
}

function StepList({ steps, testId }: { steps: ReadonlyArray<ReactNode>; testId: string }) {
  return (
    <ol data-testid={testId} className="space-y-3">
      {steps.map((content, index) => (
        <li key={index} className="text-body-sm text-foreground flex items-start gap-3">
          <span
            aria-hidden="true"
            className="bg-primary-soft text-primary-soft-foreground text-label-sm mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full tabular-nums"
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 pt-0.5">{content}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Shared, presentation-only PWA install guide dialog used by both storefront and manager entry points (#100).
 */
// Entry-point driven only: add a display cap (cooldown/session limit) if an automatic nudge is added later.
export function InstallGuide({
  open,
  onOpenChange,
  appName,
  platform,
  copy,
  onInstall,
  installing = false,
  closeLabel,
  "data-testid": testId = "install-guide",
}: InstallGuideProps) {
  if (platform === "standalone") return null;

  const title = interpolate(copy.title, { app: appName });
  const description = interpolate(copy.description, { app: appName });
  const variantTestId = `${testId}-${platform}`;
  const isDesktopSafari = platform === "macos-safari";

  const renderBody = () => {
    switch (platform) {
      case "native-prompt":
        return (
          <p data-testid={variantTestId} className="text-body-sm text-foreground">
            {interpolate(copy.nativeBody, { app: appName })}
          </p>
        );

      case "ios-safari":
        return (
          <StepList
            testId={variantTestId}
            steps={[
              <>
                {copy.iosSafariStep1}{" "}
                <Share
                  data-testid={`${testId}-share-icon`}
                  className="text-primary inline h-4 w-4 align-text-bottom"
                  aria-hidden="true"
                />
              </>,
              copy.iosStep2,
              interpolate(copy.iosStep3, { app: appName }),
            ]}
          />
        );

      case "ios-other":
        return (
          <StepList
            testId={variantTestId}
            steps={[
              <>
                {copy.iosOtherStep1}{" "}
                <Share
                  data-testid={`${testId}-share-icon`}
                  className="text-primary inline h-4 w-4 align-text-bottom"
                  aria-hidden="true"
                />
              </>,
              copy.iosStep2,
              interpolate(copy.iosStep3, { app: appName }),
            ]}
          />
        );

      case "android-manual":
        return (
          <StepList
            testId={variantTestId}
            steps={[
              <>
                {copy.androidStep1}{" "}
                <EllipsisVertical
                  className="text-primary inline h-4 w-4 align-text-bottom"
                  aria-hidden="true"
                />
              </>,
              copy.androidStep2,
              interpolate(copy.androidStep3, { app: appName }),
            ]}
          />
        );

      case "macos-safari":
        return (
          <StepList
            testId={variantTestId}
            steps={[
              copy.macosSafariStep1,
              copy.macosSafariStep2,
              interpolate(copy.macosSafariStep3, { app: appName }),
            ]}
          />
        );

      case "generic":
        return (
          <p data-testid={variantTestId} className="text-body-sm text-foreground">
            {interpolate(copy.genericBody, { app: appName })}
          </p>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid={testId}
        closeLabel={closeLabel ?? copy.close}
        className="animate-pop-in w-screen-gutter max-h-dvh max-w-sm overflow-y-auto p-5"
      >
        <DialogHeader className="text-left">
          <div className="flex items-start gap-3 pr-10">
            <span
              aria-hidden="true"
              className="bg-primary-soft text-primary-soft-foreground mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
            >
              {isDesktopSafari ? (
                <Monitor className="h-5 w-5" />
              ) : (
                <Smartphone className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-foreground">{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-1">{renderBody()}</div>

        <DialogFooter className="sm:flex-col sm:space-x-0">
          {platform === "native-prompt" ? (
            <Button
              type="button"
              onClick={onInstall}
              loading={installing}
              className="w-full gap-2"
              data-testid={`${testId}-install-button`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{copy.installButton}</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
              data-testid={`${testId}-done-button`}
            >
              {copy.done}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
