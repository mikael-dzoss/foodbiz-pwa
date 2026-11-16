"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPublicEnv, getServerEnv } from "@/config/env";
import { MOCK_AUTH_COOKIE_NAME, sanitizeManagerRedirectPath } from "@/domain/auth";
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

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/manage/login");
}

/**
 * Initiates Google OAuth sign-in flow via Supabase Auth.
 * In mock mode (development only), sets active session cookie and redirects directly.
 */
export async function signInWithGoogleAction(formData?: FormData): Promise<never> {
  const env = getServerEnv();
  const rawNext =
    formData && typeof formData.get("next") === "string" ? (formData.get("next") as string) : null;
  const safeNext = sanitizeManagerRedirectPath(rawNext);

  if (env.DATA_SOURCE === "mock") {
    const cookieStore = await cookies();
    cookieStore.set(MOCK_AUTH_COOKIE_NAME, "active", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    redirect(safeNext);
  }

  const publicEnv = getPublicEnv();
  let baseUrl: string | null = null;

  if (publicEnv.NEXT_PUBLIC_SITE_URL) {
    baseUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  } else if (env.NODE_ENV !== "production") {
    const headerStore = await headers();
    const originHeader = headerStore.get("origin");
    if (originHeader) {
      baseUrl = originHeader.replace(/\/+$/, "");
    } else {
      baseUrl = "http://localhost:3000";
    }
  }

  if (!baseUrl) {
    redirect("/manage/login?error=auth_failed");
  }

  const supabase = await createClient();
  const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error || !data?.url) {
    redirect("/manage/login?error=auth_failed");
  }

  redirect(data.url);
}

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
