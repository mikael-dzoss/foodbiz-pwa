import { z } from "zod";
import { isoDateTimeSchema, moneySchema, uuidSchema } from "./common";

export const expenseTagSchema = z.string().trim().min(1);
export type ExpenseTag = z.infer<typeof expenseTagSchema>;

export const expenseSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  amount: moneySchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^\d{4}-\d{2}-\d{2}T/, "Invalid date format"),
  description: z.string().trim().min(1),
  tags: z.array(expenseTagSchema).default([]),
  createdAt: isoDateTimeSchema,
});

export type Expense = z.infer<typeof expenseSchema>;
