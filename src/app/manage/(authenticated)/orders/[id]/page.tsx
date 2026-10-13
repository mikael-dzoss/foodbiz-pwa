import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireManagerSession } from "@/lib/auth";
import { getOrderAction } from "@/features/orders";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { APP_METADATA } from "@/config/app";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Order Details | ${APP_METADATA.name}`,
    description: `Details and status progression for order ${id}`,
  };
}

export const instant = false;

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  await requireManagerSession();
  const { id } = await params;

  const res = await getOrderAction(id);
  if (!res.success || !res.data.order) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl">
      <OrderDetail order={res.data.order} />
    </div>
  );
}
