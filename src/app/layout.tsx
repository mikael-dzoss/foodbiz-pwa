import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { APP_METADATA } from "@/config/app";
import { ThemeProvider, ThemeScript } from "@/components/theme";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_METADATA.name, template: `%s · ${APP_METADATA.shortName}` },
  description: APP_METADATA.description,
  applicationName: APP_METADATA.name,
  appleWebApp: { capable: true, title: APP_METADATA.shortName, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: APP_METADATA.themeColor,
  width: "device-width",
  initialScale: 1,
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
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
