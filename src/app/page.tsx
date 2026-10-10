import { redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "@/domain/i18n";

export const instant = false;

export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}`);
}
