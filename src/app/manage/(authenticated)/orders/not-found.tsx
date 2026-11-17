import Link from "next/link";
import { EmptyState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOCALE, getDictionary } from "@/domain/i18n";

/** Unknown order id: stays inside the shell with a way back to the order list. */
export default function OrderNotFound() {
  const text = getDictionary(DEFAULT_LOCALE).common.notFound;
  return (
    <div className="mx-auto max-w-xl space-y-4" data-testid="order-not-found">
      <EmptyState title={text.title} description={text.message} />
      <Button asChild variant="outline">
        <Link href="/manage/orders" data-testid="not-found-back-to-orders">
          {text.backToOrders}
        </Link>
      </Button>
    </div>
  );
}
