import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { isOwnerRole } from "@/domain/auth";
import { listExpenses } from "@/features/expenses/expense-data";
import { ExpenseManager } from "@/features/expenses/components";
import { getRequestNow } from "@/lib/request-time";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).expenses;
  return {
    title: dict.title,
    description: dict.subtitle,
  };
}

interface ExpensesPageProps {
  searchParams?: Promise<{ action?: string }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const session = await requireManagerSession();
  const locale = await getManagerLocale();
  const dict = getDictionary(locale);
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
