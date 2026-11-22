import Link from "next/link";
import { EmptyState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/domain/i18n";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export default async function CustomerNotFound() {
  const text = getDictionary(await getManagerLocale()).customers;
  return (
    <div className="mx-auto max-w-xl space-y-4" data-testid="customer-not-found">
      <EmptyState headingLevel={1} title={text.notFound} />
      <Button asChild variant="outline">
        <Link href="/manage/customers" data-testid="not-found-back-to-customers">
          {text.back}
        </Link>
      </Button>
    </div>
  );
}
