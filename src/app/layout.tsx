import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { APP_METADATA } from "@/config/app";
import { ThemeProvider, ThemeScript } from "@/components/theme";
import { ToastProvider } from "@/components/ui";
import { PwaInstallCapture } from "@/lib/pwa/pwa-install-capture";
import { getSiteUrl } from "@/config/site-url";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// No title template here: each area (`/[locale]` storefront, `/manage`) owns its own, so a page
// title is never suffixed twice.
export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: APP_METADATA.name,
  description: APP_METADATA.description,
  applicationName: APP_METADATA.name,
  appleWebApp: { capable: true, title: APP_METADATA.shortName, statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_METADATA.themeColor },
    { media: "(prefers-color-scheme: dark)", color: APP_METADATA.themeColorDark },
  ],
  width: "device-width",
  initialScale: 1,
  // Without `cover` every env(safe-area-inset-*) resolves to 0, so bars sit under the home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full font-sans antialiased`}
    >
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
