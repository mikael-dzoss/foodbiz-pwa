import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import type { SupportedLocale } from "@/domain/i18n";
import { ThemeProvider, ThemeScript } from "@/components/theme";
import { ToastProvider } from "@/components/ui";
import { PwaInstallCapture } from "@/lib/pwa/pwa-install-capture";
import "@/app/globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export interface RootDocumentProps {
  /** Language of the document, rendered server-side on `<html lang>`. */
  lang: SupportedLocale;
  children: ReactNode;
}

/**
 * The `<html>`/`<body>` shell shared by every root layout (storefront `[locale]`, `/manage`,
 * `/patterns`, the global 404), so fonts, theme script and providers live in one place.
 * Never add a provider whose value changes after hydration here (see theme-provider.tsx).
 */
export function RootDocument({ lang, children }: RootDocumentProps) {
  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${inter.variable} h-full font-sans antialiased`}
    >
      {/* eslint-disable-next-line @next/next/no-head-element -- App Router root layout; the pre-hydration theme script must sit in <head> */}
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">
        <PwaInstallCapture />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
