import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { DEFAULT_LOCALE, getDictionary } from "@/domain/i18n";
import { isOwnerRole } from "@/domain/auth";
import { listExpenses } from "@/features/expenses/expense-data";
import { ExpenseManager } from "@/features/expenses/components";
import { APP_METADATA } from "@/config/app";
import { getRequestNow } from "@/lib/request-time";

export const metadata: Metadata = {
  title: `Expenses | ${APP_METADATA.name}`,
  description: "Track operating costs, ingredient purchases and business expenses.",
};

interface ExpensesPageProps {
  searchParams?: Promise<{ action?: string }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const session = await requireManagerSession();
  const dict = getDictionary(DEFAULT_LOCALE);
  const params = searchParams ? await searchParams : undefined;
  const expenses = await listExpenses();
  const now = (await getRequestNow()).toISOString();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <ExpenseManager
        initialExpenses={expenses}
        now={now}
        initialAction={params?.action}
        deleteDisabledReason={
          isOwnerRole(session.user.role) ? undefined : dict.common.ownerOnlyNotice
        }
      />
    </div>
  );
}
