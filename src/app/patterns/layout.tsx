import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE } from "@/domain/i18n";
import { RootDocument, rootMetadata, rootViewport } from "@/components/root-document";
import { isDevOrTestEnvironment } from "@/lib/auth/access";

export const viewport = rootViewport;
export const metadata: Metadata = { ...rootMetadata, robots: { index: false, follow: false } };

/** Internal design-patterns page: 404 outside development and test. */
export default function PatternsLayout({ children }: { children: ReactNode }) {
  if (!isDevOrTestEnvironment()) notFound();
  return <RootDocument lang={DEFAULT_LOCALE}>{children}</RootDocument>;
}
