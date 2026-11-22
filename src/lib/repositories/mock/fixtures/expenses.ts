import type { Expense } from "@/domain/expense";
import { DEMO_BUSINESS_ID } from "./business";
import { DEMO_CATALOG_EXPENSES } from "./catalog.data";

const EXPENSE_SLOTS: readonly {
  readonly id: string;
  readonly date: string;
  readonly createdAt: string;
}[] = [
  {
    id: "55555555-5555-4555-8555-555555555501",
    date: "2026-08-12",
    createdAt: "2026-08-12T09:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555502",
    date: "2026-08-18",
    createdAt: "2026-08-18T10:30:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555503",
    date: "2026-08-25",
    createdAt: "2026-08-25T11:15:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555504",
    date: "2026-08-31",
    createdAt: "2026-08-31T08:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555505",
    date: "2026-09-05",
    createdAt: "2026-09-05T14:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555506",
    date: "2026-09-12",
    createdAt: "2026-09-12T09:30:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555507",
    date: "2026-09-19",
    createdAt: "2026-09-19T16:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555508",
    date: "2026-09-24",
    createdAt: "2026-09-24T10:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555509",
    date: "2026-09-30",
    createdAt: "2026-09-30T08:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555510",
    date: "2026-10-02",
    createdAt: "2026-10-02T11:20:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555511",
    date: "2026-10-06",
    createdAt: "2026-10-06T15:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555512",
    date: "2026-10-08",
    createdAt: "2026-10-08T13:45:00.000Z",
  },
];

export const demoExpenses: Expense[] = DEMO_CATALOG_EXPENSES.map((expense, index) => {
  const slot = EXPENSE_SLOTS[index];
  return {
    id: slot.id,
    businessId: DEMO_BUSINESS_ID,
    amount: expense.amount,
    date: slot.date,
    description: expense.description,
    tags: [expense.tag],
    createdAt: slot.createdAt,
  };
});
