"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Check, Copy, Download, ExternalLink, Monitor, Share, Smartphone } from "lucide-react";
import { interpolate, type InstallGuideDictionary } from "@/domain/i18n";
import {
  buildAndroidChromeIntentUrl,
  isInAppPlatform,
  type InstallPlatform,
} from "@/lib/pwa/platform";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
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

function ShareGlyph({ testId }: { testId: string }) {
  return (
    <Share
      data-testid={testId}
      className="text-primary inline h-4 w-4 align-text-bottom"
      aria-hidden="true"
    />
  );
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

type CopyLinkState =
  { status: "idle" } | { status: "copied" } | { status: "fallback"; url: string };

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
  // Freeze the platform on open so a late beforeinstallprompt or standalone flip doesn't swap the
  // dialog body mid-read (or while awaiting the native prompt); re-captured on the next open.
  const [captured, setCaptured] = useState<{ open: boolean; platform: InstallPlatform }>({
    open,
    platform,
  });
  const [copyState, setCopyState] = useState<CopyLinkState>({ status: "idle" });

  if (open !== captured.open) {
    setCaptured({ open, platform });
    if (copyState.status !== "idle") {
      setCopyState({ status: "idle" });
    }
  }

  const activePlatform = open ? captured.platform : platform;

  if (activePlatform === "standalone") return null;

  const isInApp = isInAppPlatform(activePlatform);
  const isAndroidInApp = isInApp && activePlatform.os === "android";
  const title = interpolate(copy.title, { app: appName });
  const description = interpolate(copy.description, { app: appName });
  const variantTestId = isInApp ? `${testId}-in-app` : `${testId}-${activePlatform}`;
  const isDesktopSafari = activePlatform === "macos-safari";

  const handleCopyLink = async () => {
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
      try {
        await navigator.clipboard.writeText(currentUrl);
        setCopyState({ status: "copied" });
        return;
      } catch {
        // Restricted webviews often reject clipboard writes; fall through to the selectable URL.
      }
    }
    setCopyState({ status: "fallback", url: currentUrl });
  };

  const handleOpenInChrome = (event: MouseEvent<HTMLAnchorElement>) => {
    // Build intent:// from window.location at click time so SSR/initial render never touches window.
    event.currentTarget.setAttribute("href", buildAndroidChromeIntentUrl(window.location));
  };

  const renderInAppBody = () => {
    if (!isInApp) return null;
    const hostApp = activePlatform.app ?? copy.inAppGenericName;
    const steps: ReadonlyArray<ReactNode> =
      activePlatform.os === "ios"
        ? [
            <>
              {copy.inAppIosStep1} <ShareGlyph testId={`${variantTestId}-share-icon`} />
            </>,
            copy.inAppIosStep2,
          ]
        : activePlatform.os === "android"
          ? [copy.inAppAndroidStep1, copy.inAppAndroidStep2]
          : [copy.inAppOtherStep1, copy.inAppOtherStep2];

    return (
      <div data-testid={variantTestId} className="space-y-4">
        <p data-testid={`${variantTestId}-explanation`} className="text-body-sm text-foreground">
          {interpolate(copy.inAppExplanation, { inApp: hostApp })}
        </p>

        <StepList testId={`${variantTestId}-steps`} steps={steps} />

        <div role="status" aria-live="polite" className="empty:hidden">
          {copyState.status === "copied" ? (
            <p
              data-testid={`${testId}-copy-confirmation`}
              className="bg-primary-soft text-primary-soft-foreground text-body-sm flex items-center gap-2 rounded-md px-3 py-2"
            >
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{copy.inAppLinkCopied}</span>
            </p>
          ) : null}
          {copyState.status === "fallback" ? (
            <div
              data-testid={`${testId}-copy-fallback`}
              className="bg-muted space-y-2 rounded-md p-3"
            >
              <p className="text-body-sm text-foreground">{copy.inAppCopyFallback}</p>
              <Input
                readOnly
                value={copyState.url}
                aria-label={copy.inAppCopyUrlLabel}
                onFocus={(event) => event.currentTarget.select()}
                data-testid={`${testId}-copy-fallback-input`}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderBody = () => {
    if (isInApp) return renderInAppBody();

    switch (activePlatform) {
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
                {copy.iosSafariStep1} <ShareGlyph testId={`${variantTestId}-share-icon`} />
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
                {copy.iosOtherStep1} <ShareGlyph testId={`${variantTestId}-share-icon`} />
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
              copy.androidStep1,
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

  const renderFooter = () => {
    if (isInApp) {
      return (
        <>
          {isAndroidInApp ? (
            <Button asChild className="w-full gap-2" data-testid={`${testId}-open-chrome-link`}>
              <a href="#open-in-chrome" onClick={handleOpenInChrome}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>{copy.inAppOpenInChrome}</span>
              </a>
            </Button>
          ) : null}

          <Button
            type="button"
            variant={isAndroidInApp ? "outline" : "default"}
            onClick={handleCopyLink}
            className="w-full gap-2"
            data-testid={`${testId}-copy-link-button`}
          >
            {copyState.status === "copied" ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{copy.inAppCopyLink}</span>
          </Button>

          <Button
            type="button"
            variant={isAndroidInApp ? "ghost" : "outline"}
            onClick={() => onOpenChange(false)}
            className="w-full"
            data-testid={`${testId}-done-button`}
          >
            {copy.done}
          </Button>
        </>
      );
    }

    if (activePlatform === "native-prompt") {
      return (
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
      );
    }

    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        className="w-full"
        data-testid={`${testId}-done-button`}
      >
        {copy.done}
      </Button>
    );
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
              ) : isInApp ? (
                <ExternalLink className="h-5 w-5" />
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

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {renderFooter()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
