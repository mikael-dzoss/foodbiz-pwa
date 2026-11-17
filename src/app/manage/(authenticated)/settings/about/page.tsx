import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ShieldCheck, ExternalLink, Heart } from "lucide-react";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary, interpolate } from "@/domain/i18n";
import { APP_METADATA } from "@/config/app";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export const metadata: Metadata = {
  title: "About",
  description: "Version, legal and support information.",
};

export default async function AboutPage() {
  await requireManagerSession();
  const locale = await getManagerLocale();
  const dict = getDictionary(locale);
  const x = dict.settingsExtra;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 pb-24" data-testid="about-page">
      {/* Top Bar Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/manage/settings"
          data-testid="back-to-settings"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>{dict.settings.title}</span>
        </Link>
        <span className="text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
          {"M-68"}
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-title-lg text-foreground">{dict.settings.about.title}</h1>
        <p className="text-body-sm text-muted-foreground mt-1">{x.about.intro}</p>
      </div>

      <div className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-xl font-bold">
            F
          </div>
          <div>
            <h2 className="text-title-sm text-foreground">{APP_METADATA.name}</h2>
            <p className="text-muted-foreground text-xs">
              {interpolate(x.about.versionBuild, { version: dict.settings.about.version })}
            </p>
          </div>
        </div>

        <div className="border-border divide-border divide-y border-t pt-3">
          <a
            href="https://github.com/mikael-dzoss/foodbiz-pwa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground flex items-center justify-between py-3 text-sm font-medium transition-colors"
          >
            <span>{x.about.github}</span>
            <ExternalLink className="h-4 w-4" />
          </a>
          <Link
            href={`/${locale}/legal/terms`}
            className="text-muted-foreground hover:text-foreground flex items-center justify-between py-3 text-sm font-medium transition-colors"
          >
            <span>{x.about.terms}</span>
            <ExternalLink className="h-4 w-4" />
          </Link>
          <Link
            href={`/${locale}/legal/privacy`}
            className="text-muted-foreground hover:text-foreground flex items-center justify-between py-3 text-sm font-medium transition-colors"
          >
            <span>{x.about.privacy}</span>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>

        <div className="border-border bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-xl p-3 text-xs">
          <ShieldCheck className="text-primary h-4 w-4 shrink-0" />
          <span>{x.about.serverRegion}</span>
        </div>
      </div>

      <div className="text-muted-foreground mt-8 flex items-center justify-center gap-1.5 text-xs">
        <span>{x.about.builtWith}</span>
        <Heart className="text-destructive h-3.5 w-3.5 fill-current" />
        <span>{x.about.forBusinesses}</span>
      </div>
    </div>
  );
}
