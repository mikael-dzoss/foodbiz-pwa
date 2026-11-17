import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, getDictionary, isSupportedLocale } from "@/domain/i18n";
import { listCustomers } from "@/features/customers/customer-data";
import { CustomerList } from "@/features/customers/components/customer-list";

export const metadata: Metadata = { title: "Customers | FoodBiz" };

export default async function CustomersPage() {
  const customers = await listCustomers();
  const preference = (await cookies()).get("foodbiz_locale")?.value ?? DEFAULT_LOCALE;
  const locale = isSupportedLocale(preference) ? preference : DEFAULT_LOCALE;
  return (
    <div className="mx-auto max-w-xl">
      <CustomerList customers={customers} dict={getDictionary(locale).customers} locale={locale} />
    </div>
  );
}
