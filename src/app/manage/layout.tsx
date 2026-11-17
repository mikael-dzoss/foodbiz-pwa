import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_METADATA } from "@/config/app";

export interface ManageRootLayoutProps {
  children: ReactNode;
}

// Pages set a bare title ("Orders"); the template appends the app name exactly once.
export const metadata: Metadata = {
  title: { default: APP_METADATA.name, template: `%s · ${APP_METADATA.name}` },
  robots: { index: false, follow: false },
};

export default function ManageRootLayout({ children }: ManageRootLayoutProps) {
  return <>{children}</>;
}
