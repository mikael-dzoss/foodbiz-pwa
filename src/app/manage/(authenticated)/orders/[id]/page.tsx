import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireManagerSession } from "@/lib/auth";
import { getOrder } from "@/features/orders/order-data";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { DEFAULT_LOCALE, getDictionary } from "@/domain/i18n";
import { isOwnerRole } from "@/domain/auth";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Order Details",
    description: `Details and status progression for order ${id}`,
  };
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await requireManagerSession();
  const dict = getDictionary(DEFAULT_LOCALE);
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
