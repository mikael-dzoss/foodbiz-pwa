"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/config/env";
import { MOCK_AUTH_COOKIE_NAME } from "@/domain/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Clears the manager session and redirects to /manage/login.
 */
export async function signOutAction(): Promise<never> {
  const env = getServerEnv();

  if (env.DATA_SOURCE === "mock") {
    const cookieStore = await cookies();
    cookieStore.set(MOCK_AUTH_COOKIE_NAME, "signed-out", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
    redirect("/manage/login");
  }

  // TODO(supabase): Complete production Supabase sign-out workflow (#37, #38):
  // 1. Invalidate active session and refresh token via supabase.auth.signOut().
  // 2. Clear any persisted tenant/business claims.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/manage/login");
}

// TODO(supabase): Implement signInWithOAuth / Google sign-in server action via Supabase Auth (#38) once Supabase project is active (#117).

/**
 * Sets the mock session cookie to active in development mode.
 * Strictly forbidden in production.
 */
export async function signInMockAction(): Promise<never> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Mock sign-in cannot be enabled in production");
  }

  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE_NAME, "active", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/manage");
}
