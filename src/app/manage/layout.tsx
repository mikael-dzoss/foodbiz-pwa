import type { ReactNode } from "react";

export interface ManageRootLayoutProps {
  children: ReactNode;
}

export default function ManageRootLayout({ children }: ManageRootLayoutProps) {
  return <>{children}</>;
}
