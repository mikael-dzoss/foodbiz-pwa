import type { Metadata } from "next";
import { getDictionary } from "@/domain/i18n";
import { requireManagerSession } from "@/lib/auth";
import { getManagerLocale } from "@/lib/i18n/manager-locale";
import { listOrders } from "@/features/orders/order-data";
import { OrderList } from "@/features/orders/components/order-list";
import { getRequestNow } from "@/lib/request-time";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale());
  return {
    title: dict.orders.title,
    description: dict.manager.meta.ordersDescription,
  };
}

interface OrdersPageProps {
  searchParams?: Promise<{ tab?: string; unpaid?: string; payment?: string }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps = {}) {
  await requireManagerSession();
  const params = searchParams ? await searchParams : undefined;
  const isUnpaid = params?.unpaid === "true" || params?.payment === "unpaid";
  const validTabs = ["active", "completed", "cancelled"] as const;
  const initialTab =
    params?.tab && (validTabs as readonly string[]).includes(params.tab)
      ? (params.tab as (typeof validTabs)[number])
      : "active";

  const initialData = await listOrders({ statusTab: "all" });
  const now = (await getRequestNow()).toISOString();

  return (
    <div className="mx-auto max-w-xl">
      <OrderList
        initialData={initialData}
        initialTab={initialTab}
        initialUnpaidOnly={isUnpaid}
        now={now}
      />
    </div>
  );
}
