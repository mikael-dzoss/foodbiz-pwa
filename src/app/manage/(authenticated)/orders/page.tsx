import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { listOrdersAction } from "@/features/orders";
import { OrderList } from "@/features/orders/components/order-list";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Orders | ${APP_METADATA.name}`,
  description: "Triage and manage incoming orders by status and requested time.",
};

export const instant = false;

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

  const res = await listOrdersAction({ statusTab: "all" });

  const initialData = res.success
    ? res.data
    : {
        orders: [],
        counts: {
          active: 0,
          completed: 0,
          cancelled: 0,
          total: 0,
          unpaid: 0,
          pickup: 0,
          delivery: 0,
        },
      };

  return (
    <div className="mx-auto max-w-xl">
      <OrderList initialData={initialData} initialTab={initialTab} initialUnpaidOnly={isUnpaid} />
    </div>
  );
}
