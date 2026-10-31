import { z } from "zod";

export const allergenSchema = z.enum([
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soybeans",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
]);

export type Allergen = z.infer<typeof allergenSchema>;
