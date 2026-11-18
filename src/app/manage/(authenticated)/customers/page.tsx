import type { Metadata } from "next";
import { getDictionary } from "@/domain/i18n";
import { getManagerLocale } from "@/lib/i18n/manager-locale";
import { listCustomers } from "@/features/customers/customer-data";
import { CustomerList } from "@/features/customers/components/customer-list";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const customers = await listCustomers();
  const locale = await getManagerLocale();
  return (
    <div className="mx-auto max-w-xl">
      <CustomerList customers={customers} dict={getDictionary(locale).customers} locale={locale} />
    </div>
  );
}
