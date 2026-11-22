import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Heart } from "lucide-react";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary, interpolate } from "@/domain/i18n";
import { SoonItem } from "@/components/feedback";
import { APP_METADATA } from "@/config/app";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale());
  return {
    title: dict.settings.about.title,
    description: dict.settingsExtra.about.intro,
  };
}

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

        {/* TODO(legal): replace with links to /[locale]/legal/* once the legal pages ship (#97);
            see LEGAL_PAGES_AVAILABLE in config/app. */}
        <div className="border-border divide-border divide-y border-t pt-3">
          <SoonItem
            featureKey="legal.terms"
            description=""
            className="bg-transparent px-0"
            data-testid="soon-legal-terms"
          />
          <SoonItem
            featureKey="legal.privacy"
            description=""
            className="border-b-0 bg-transparent px-0"
            data-testid="soon-legal-privacy"
          />
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
