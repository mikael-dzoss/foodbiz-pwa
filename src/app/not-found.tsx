import Link from "next/link";
import { EmptyState } from "@/components/feedback";
import { Button } from "@/components/ui";
import { DEFAULT_LOCALE, getDictionary } from "@/domain/i18n";

// The root fallback has no locale (non-localized URL): it uses the default language.
export default function NotFound() {
  const { pageNotFound, backToHome } = getDictionary(DEFAULT_LOCALE).common;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <EmptyState title={pageNotFound.title} description={pageNotFound.message} />
      <div className="mt-4">
        <Button asChild>
          <Link href="/">{backToHome}</Link>
        </Button>
      </div>
    </div>
  );
}
