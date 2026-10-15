import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { listExpensesAction } from "@/features/expenses";
import { ExpenseManager } from "@/features/expenses/components";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Expenses | ${APP_METADATA.name}`,
  description: "Track operating costs, ingredient purchases and business expenses.",
};

export const instant = false;

interface ExpensesPageProps {
  searchParams?: Promise<{ action?: string }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await requireManagerSession();
  const params = searchParams ? await searchParams : undefined;
  const res = await listExpensesAction();

  const expenses = res.success ? res.data : [];

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <ExpenseManager initialExpenses={expenses} initialAction={params?.action} />
    </div>
  );
}
