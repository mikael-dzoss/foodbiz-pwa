import Link from "next/link";
import { EmptyState } from "@/components/feedback";
import { RootDocument } from "@/components/root-document";
import { Button } from "@/components/ui";
import { DEFAULT_LOCALE, getDictionary } from "@/domain/i18n";

// Unmatched URLs have no locale: this global 404 uses the default language and renders its own
// document (the app has several root layouts, so there is no single layout to compose it from).
export default function GlobalNotFound() {
  const { pageNotFound, backToHome } = getDictionary(DEFAULT_LOCALE).common;
  return (
    <RootDocument lang={DEFAULT_LOCALE}>
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <EmptyState
          headingLevel={1}
          title={pageNotFound.title}
          description={pageNotFound.message}
        />
        <div className="mt-4">
          <Button asChild>
            <Link href="/">{backToHome}</Link>
          </Button>
        </div>
      </main>
    </RootDocument>
  );
}
