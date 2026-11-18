import Link from "next/link";
import { EmptyState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/domain/i18n";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

/** Unknown order id: stays inside the shell with a way back to the order list. */
export default async function OrderNotFound() {
  const locale = await getManagerLocale();
  const text = getDictionary(locale).common.notFound;
  return (
    <div className="mx-auto max-w-xl space-y-4" data-testid="order-not-found">
      <EmptyState headingLevel={1} title={text.title} description={text.message} />
      <Button asChild variant="outline">
        <Link href="/manage/orders" data-testid="not-found-back-to-orders">
          {text.backToOrders}
        </Link>
      </Button>
    </div>
  );
}
