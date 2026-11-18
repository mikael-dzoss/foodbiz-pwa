import Link from "next/link";
import { EmptyState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/domain/i18n";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

/** Rendered inside the manager shell when a page or record in the shell calls `notFound()`. */
export default async function ManageNotFound() {
  const text = getDictionary(await getManagerLocale()).common.notFound;
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
