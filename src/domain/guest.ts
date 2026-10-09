import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";

export const guestSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  name: z.string().trim().min(1),
  phone: z.string().trim().optional().nullable(),
  email: z.string().email().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  createdAt: isoDateTimeSchema,
});

export type Guest = z.infer<typeof guestSchema>;
