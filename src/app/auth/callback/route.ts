import { NextResponse, type NextRequest } from "next/server";
import { normalizeAuthErrorCode, sanitizeManagerRedirectPath } from "@/domain/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next");

  const safeNext = sanitizeManagerRedirectPath(next);

  if (error) {
    const mapped = normalizeAuthErrorCode(error, errorDescription) ?? "auth_failed";
    return NextResponse.redirect(new URL(`/manage/login?error=${mapped}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/manage/login?error=auth_failed", request.url));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL("/manage/login?error=auth_failed", request.url));
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}
