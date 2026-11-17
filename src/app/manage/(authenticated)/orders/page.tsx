import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { listOrders } from "@/features/orders/order-data";
import { OrderList } from "@/features/orders/components/order-list";
import { getRequestNow } from "@/lib/request-time";

export const metadata: Metadata = {
  title: "Orders",
  description: "Triage and manage incoming orders by status and requested time.",
};

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
