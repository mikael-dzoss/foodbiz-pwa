import Link from "next/link";
import { EmptyState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOCALE, getDictionary } from "@/domain/i18n";

/** Rendered inside the manager shell when a page or record in the shell calls `notFound()`. */
export default function ManageNotFound() {
  const text = getDictionary(DEFAULT_LOCALE).common.notFound;
  return (
    <div className="mx-auto max-w-xl space-y-4" data-testid="manage-not-found">
      <EmptyState title={text.title} description={text.message} />
      <Button asChild variant="outline">
        <Link href="/manage" data-testid="manage-not-found-dashboard">
          {text.backToDashboard}
        </Link>
      </Button>
    </div>
  );
}
