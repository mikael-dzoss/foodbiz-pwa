import { z } from "zod";

/**
 * Public (browser-safe) environment variables.
 * Values must be referenced statically (`process.env.NEXT_PUBLIC_*`) so Next.js can inline them.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.url().optional(),
  ),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    const keys = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid public environment variables: ${keys}. See .env.example.`);
  }
  return result.data;
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

export const dataSourceSchema = z.enum(["mock", "supabase"]);
export type DataSource = z.infer<typeof dataSourceSchema>;

const serverEnvSchema = z
  .object({
    DATA_SOURCE: dataSourceSchema.default("mock"),
    NODE_ENV: z.string().optional(),
    APP_ENV: z.enum(["development", "test", "staging", "production"]).optional(),
    ALLOWED_MANAGER_EMAILS: z.string().optional(),
    DEV_BUSINESS_SLUG: z.string().trim().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      const nodeEnv = data.NODE_ENV ?? process.env.NODE_ENV;
      const appEnv = data.APP_ENV ?? process.env.APP_ENV;
      if ((nodeEnv === "production" || appEnv === "production") && data.DATA_SOURCE === "mock") {
        return false;
      }
      return true;
    },
    {
      message:
        "Mock manager session cannot be enabled in production: DATA_SOURCE cannot be 'mock' in production",
      path: ["DATA_SOURCE"],
    },
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const keys = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid server environment variables: ${keys}. See .env.example.`);
  }
  return result.data;
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv({
    DATA_SOURCE: process.env.DATA_SOURCE,
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    ALLOWED_MANAGER_EMAILS: process.env.ALLOWED_MANAGER_EMAILS,
    DEV_BUSINESS_SLUG: process.env.DEV_BUSINESS_SLUG,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
