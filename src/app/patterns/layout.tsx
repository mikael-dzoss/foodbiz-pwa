import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isDevOrTestEnvironment } from "@/lib/auth/access";

/** Internal design-patterns page: 404 outside development and test. */
export default function PatternsLayout({ children }: { children: ReactNode }) {
  if (!isDevOrTestEnvironment()) notFound();
  return children;
}
