import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireManagerSession } from "@/lib/auth";
import { getOrder } from "@/features/orders/order-data";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { getDictionary } from "@/domain/i18n";
import { isOwnerRole } from "@/domain/auth";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale());
  return {
    title: dict.manager.meta.orderDetailTitle,
    description: dict.manager.meta.orderDetailDescription,
  };
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await requireManagerSession();
  const locale = await getManagerLocale();
  const dict = getDictionary(locale);
  const { id } = await params;

  const found = await getOrder(id);
  if (!found) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <OrderDetail
        order={found.order}
        refundDisabledReason={
          isOwnerRole(session.user.role) ? undefined : dict.common.ownerOnlyNotice
        }
      />
    </div>
  );
}
