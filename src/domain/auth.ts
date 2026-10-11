import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";
import { businessMemberRoleSchema } from "./business";

export const managerUserSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string().trim().min(1),
  role: businessMemberRoleSchema,
  businessId: uuidSchema,
});

export type ManagerUser = z.infer<typeof managerUserSchema>;

export const managerBusinessSummarySchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  currency: z.literal("EUR").default("EUR"),
});

export type ManagerBusinessSummary = z.infer<typeof managerBusinessSummarySchema>;

export const managerSessionSchema = z.object({
  user: managerUserSchema,
  business: managerBusinessSummarySchema,
  expiresAt: isoDateTimeSchema,
});

export type ManagerSession = z.infer<typeof managerSessionSchema>;

export const MOCK_MANAGER_SESSION: ManagerSession = {
  user: {
    id: "00000000-0000-4000-8000-000000000002",
    email: "manager@lapetiteboulangerie.fr",
    name: "Marie Dupont",
    role: "manager",
    businessId: "11111111-1111-4111-8111-111111111111",
  },
  business: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "La Petite Boulangerie",
    slug: "la-petite-boulangerie",
    currency: "EUR",
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
};
