"use client";

import * as React from "react";
import { Plus, Receipt, ChevronRight, Utensils, Truck, Wrench, Package, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback";
import {
  formatCalendarDate,
  getZonedDay,
  formatMoney,
  groupExpensesByMonth,
  filterExpenses,
  calculateExpensesTotal,
  STANDARD_EXPENSE_TAGS,
  type Expense,
  type ExpensePeriodFilter,
} from "@/domain";
import { useBusinessTimeZone } from "@/components/time/business-timezone";
import { ExpenseSheet } from "./expense-sheet";

export interface ExpenseManagerProps {
  initialExpenses: Expense[];
  /** The server's current instant (ISO): "this month" and the default date follow it. */
  now: string;
  initialAction?: string;
  /** Set for members who may not delete (owner-only): explains why the delete control is disabled. */
  deleteDisabledReason?: string;
}

export function ExpenseManager({
  initialExpenses,
  now,
  initialAction,
  deleteDisabledReason,
}: ExpenseManagerProps) {
  const timeZone = useBusinessTimeZone();
  const [expenses, setExpenses] = React.useState<Expense[]>(initialExpenses);
  const [periodFilter, setPeriodFilter] = React.useState<ExpensePeriodFilter>("this-month");
  const [selectedTag, setSelectedTag] = React.useState<string>("all");

  // Sheet states
  const [sheetOpen, setSheetOpen] = React.useState(initialAction === "new");
  const [editingExpense, setEditingExpense] = React.useState<Expense | null>(null);

  // Sync state if initialExpenses updates (e.g. server revalidation)
  const [prevInitial, setPrevInitial] = React.useState<Expense[]>(initialExpenses);
  if (initialExpenses !== prevInitial) {
    setPrevInitial(initialExpenses);
    setExpenses(initialExpenses);
  }

  // Filter expenses according to selected period and tag
  const filteredExpenses = React.useMemo(() => {
    return filterExpenses(expenses, {
      period: periodFilter,
      tag: selectedTag,
      referenceDate: now,
      timeZone,
    });
  }, [expenses, periodFilter, selectedTag, now, timeZone]);

  // Group filtered expenses by month
  const monthGroups = React.useMemo(() => {
    return groupExpensesByMonth(filteredExpenses);
  }, [filteredExpenses]);

  // Overall total spent for the active filter view
  const currentTotal = React.useMemo(() => {
    return calculateExpensesTotal(filteredExpenses);
  }, [filteredExpenses]);

  // Counts for each tag within the selected period (for filter pill badges)
  const tagCounts = React.useMemo(() => {
    const periodFiltered = filterExpenses(expenses, {
      period: periodFilter,
      referenceDate: now,
      timeZone,
    });
    const counts: Record<string, number> = {
      all: periodFiltered.length,
    };
    for (const tag of STANDARD_EXPENSE_TAGS) {
      counts[tag] = periodFiltered.filter((e) => e.tags.includes(tag)).length;
    }
    return counts;
  }, [expenses, periodFilter, now, timeZone]);

  // Category breakdown percentages for monthly KPI mini-bar
  const categoryBreakdown = React.useMemo(() => {
    if (currentTotal === 0) return [];
    return STANDARD_EXPENSE_TAGS.map((tag) => {
      const tagExpenses = filteredExpenses.filter((e) => e.tags.includes(tag));
      const tagTotal = calculateExpensesTotal(tagExpenses);
      const percentage = Math.round((tagTotal / currentTotal) * 100);
      return { tag, total: tagTotal, percentage };
    }).filter((c) => c.total > 0);
  }, [filteredExpenses, currentTotal]);

  const handleExpenseSaved = (saved: Expense) => {
    setExpenses((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const handleExpenseDeleted = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const openCreateSheet = () => {
    setEditingExpense(null);
    setSheetOpen(true);
  };

  const openEditSheet = (exp: Expense) => {
    setEditingExpense(exp);
    setSheetOpen(true);
  };

  const getTagIcon = (tag: string) => {
    switch (tag) {
      case "Ingredients":
        return <Utensils className="h-4 w-4" />;
      case "Transport":
        return <Truck className="h-4 w-4" />;
      case "Equipment":
        return <Wrench className="h-4 w-4" />;
      case "Supplies":
        return <Package className="h-4 w-4" />;
      case "Utilities":
        return <Zap className="h-4 w-4" />;
      default:
        return <Receipt className="h-4 w-4" />;
    }
  };

  const getTagColorClass = (tag: string) => {
    switch (tag) {
      case "Ingredients":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      case "Transport":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20";
      case "Equipment":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "Supplies":
        return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20";
      case "Utilities":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const formatDateDisplay = (dateStr: string) => formatCalendarDate(dateStr, "en");

  return (
    <div className="space-y-4 pb-20" data-testid="expenses-manager">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-2xl font-bold tracking-tight">Expenses</h1>
            <span className="text-muted-foreground border-border rounded border px-1.5 py-0.5 font-mono text-xs">
              Screen M-50
            </span>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Track business operating costs, ingredients and supplier invoices.
          </p>
        </div>

        <Button
          onClick={openCreateSheet}
          className="gap-1.5 shadow-sm"
          data-testid="add-expense-button"
        >
          <Plus className="h-4 w-4" />
          <span>Add expense</span>
        </Button>
      </div>

      {/* Period Segmented Control */}
      <div className="bg-muted/50 border-border flex rounded-xl border p-1">
        <button
          type="button"
          onClick={() => setPeriodFilter("this-month")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            periodFilter === "this-month"
              ? "bg-card text-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="period-filter-this-month"
        >
          This month
        </button>
        <button
          type="button"
          onClick={() => setPeriodFilter("last-month")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            periodFilter === "last-month"
              ? "bg-card text-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="period-filter-last-month"
        >
          Last month
        </button>
        <button
          type="button"
          onClick={() => setPeriodFilter("all")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            periodFilter === "all"
              ? "bg-card text-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="period-filter-all"
        >
          All time
        </button>
      </div>

      {/* Monthly Summary KPI Card */}
      <div
        className="bg-card border-border space-y-3 rounded-xl border p-4 shadow-xs"
        data-testid="expenses-kpi-card"
      >
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Total Spent (
            {periodFilter === "this-month"
              ? "This month"
              : periodFilter === "last-month"
                ? "Last month"
                : "All time"}
            )
          </span>
          <span className="text-muted-foreground text-xs">
            {filteredExpenses.length} {filteredExpenses.length === 1 ? "expense" : "expenses"}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
            {formatMoney(currentTotal)}
          </div>
        </div>

        {/* Mini Category Budget Distribution Bar */}
        {categoryBreakdown.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="bg-muted/60 flex h-2 w-full overflow-hidden rounded-full">
              {categoryBreakdown.map((item) => (
                <div
                  key={item.tag}
                  style={{ width: `${item.percentage}%` }}
                  title={`${item.tag}: ${item.percentage}%`}
                  className={
                    item.tag === "Ingredients"
                      ? "bg-emerald-500"
                      : item.tag === "Transport"
                        ? "bg-sky-500"
                        : item.tag === "Equipment"
                          ? "bg-amber-500"
                          : item.tag === "Supplies"
                            ? "bg-indigo-500"
                            : "bg-purple-500"
                  }
                />
              ))}
            </div>
            <div className="text-muted-foreground text-caption flex flex-wrap gap-x-3 gap-y-1">
              {categoryBreakdown.map((item) => (
                <span key={item.tag} className="flex items-center gap-1">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      item.tag === "Ingredients"
                        ? "bg-emerald-500"
                        : item.tag === "Transport"
                          ? "bg-sky-500"
                          : item.tag === "Equipment"
                            ? "bg-amber-500"
                            : item.tag === "Supplies"
                              ? "bg-indigo-500"
                              : "bg-purple-500"
                    }`}
                  />
                  <span>
                    {item.tag} ({item.percentage}%)
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tag Filter Pills Row */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1">
        <button
          type="button"
          onClick={() => setSelectedTag("all")}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
            selectedTag === "all"
              ? "bg-primary-soft text-primary-soft-foreground border-primary"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
          data-testid="tag-filter-all"
        >
          <span>All</span>
          <span className="font-mono opacity-75">({tagCounts.all ?? 0})</span>
        </button>

        {STANDARD_EXPENSE_TAGS.map((tag) => {
          const isSelected = selectedTag === tag;
          const count = tagCounts[tag] ?? 0;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? "bg-primary-soft text-primary-soft-foreground border-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
              data-testid={`tag-filter-${tag}`}
            >
              <span>{tag}</span>
              <span className="font-mono opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Monthly Grouped Expense List */}
      {monthGroups.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="No expenses found"
          description={
            expenses.length === 0
              ? "You haven't recorded any expenses yet. Start tracking ingredients, equipment and costs."
              : "No expenses match the current period and category filters."
          }
          action={{
            label: "Add expense",
            onClick: openCreateSheet,
          }}
          data-testid="expenses-empty-state"
        />
      ) : (
        <div className="space-y-4" data-testid="expenses-list">
          {monthGroups.map((group) => (
            <div key={group.monthKey} className="space-y-1.5">
              {/* Group Section Header */}
              <div className="text-muted-foreground flex items-center justify-between px-1 text-xs font-semibold tracking-wider uppercase">
                <span data-testid={`month-header-${group.monthKey}`}>{group.monthLabel}</span>
                <span className="text-foreground font-medium tabular-nums">
                  {formatMoney(group.totalAmount)}
                </span>
              </div>

              {/* Group rows card */}
              <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-xl border">
                {group.expenses.map((expense) => {
                  const mainTag = expense.tags[0] ?? "Expenses";
                  return (
                    <button
                      key={expense.id}
                      type="button"
                      onClick={() => openEditSheet(expense)}
                      className="hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center gap-3 p-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      data-testid={`expense-row-${expense.id}`}
                    >
                      {/* Left category icon chip */}
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${getTagColorClass(
                          mainTag,
                        )}`}
                      >
                        {getTagIcon(mainTag)}
                      </div>

                      {/* Center details */}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground truncate text-sm font-medium">
                            {expense.description}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                          <span>{formatDateDisplay(expense.date)}</span>
                          <span>•</span>
                          <span className="font-medium">{mainTag}</span>
                        </div>
                      </div>

                      {/* Right amount and chevron */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground text-sm font-semibold tabular-nums">
                          {formatMoney(expense.amount)}
                        </span>
                        <ChevronRight className="text-muted-foreground/60 h-4 w-4 shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expense Form & Modal Sheet (Screen M-51) */}
      <ExpenseSheet
        today={getZonedDay(now, timeZone)}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        expense={editingExpense}
        onSaved={handleExpenseSaved}
        onDeleted={handleExpenseDeleted}
        deleteDisabledReason={deleteDisabledReason}
      />
    </div>
  );
}
