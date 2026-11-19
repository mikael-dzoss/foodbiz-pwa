import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/domain/i18n";
import { getManagerLocale } from "@/lib/i18n/manager-locale";
import { getCustomer } from "@/features/customers/customer-data";
import { CustomerDetail } from "@/features/customers/components/customer-detail";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).manager.meta;
  return {
    title: dict.customerDetailTitle,
    description: dict.customerDetailDescription,
  };
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCustomer(id);
  if (!detail) notFound();
  const locale = await getManagerLocale();
  return (
    <div className="mx-auto max-w-xl">
      <CustomerDetail
        summary={detail.summary}
        orders={detail.orders}
        dict={getDictionary(locale)}
      />
    </div>
  );
}
