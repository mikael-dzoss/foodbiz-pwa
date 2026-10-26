import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE, getDictionary, isSupportedLocale } from "@/domain/i18n";
import { getCustomer } from "@/features/customers/customer-data";
import { CustomerDetail } from "@/features/customers/components/customer-detail";

export const metadata: Metadata = { title: "Customer details | FoodBiz" };
export const instant = false;

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCustomer(id);
  if (!detail) notFound();
  const preference = (await cookies()).get("foodbiz_locale")?.value ?? DEFAULT_LOCALE;
  const locale = isSupportedLocale(preference) ? preference : DEFAULT_LOCALE;
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
