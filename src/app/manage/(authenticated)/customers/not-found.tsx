import Link from "next/link";
import { cookies } from "next/headers";
import { EmptyState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOCALE, getDictionary, isSupportedLocale } from "@/domain/i18n";

export default async function CustomerNotFound() {
  const preference = (await cookies()).get("foodbiz_locale")?.value ?? DEFAULT_LOCALE;
  const text = getDictionary(isSupportedLocale(preference) ? preference : DEFAULT_LOCALE).customers;
  return (
    <div className="mx-auto max-w-xl space-y-4" data-testid="customer-not-found">
      <EmptyState title={text.notFound} />
      <Button asChild variant="outline">
        <Link href="/manage/customers" data-testid="not-found-back-to-customers">
          {text.back}
        </Link>
      </Button>
    </div>
  );
}
