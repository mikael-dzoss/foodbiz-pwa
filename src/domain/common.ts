import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const moneySchema = z.number().int().min(0);
export const isoDateTimeSchema = z.string().datetime();
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");
export const timeHHMMSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time format (HH:MM)");
