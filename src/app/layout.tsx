import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_METADATA } from "@/config/app";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
