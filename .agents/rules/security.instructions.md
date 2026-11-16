---
trigger: model_decision
paths:
  - "src/proxy.ts"
  - "src/lib/supabase/**"
  - "src/config/**"
  - "src/features/auth/**"
  - "**/actions.ts"
  - "next.config.ts"
  - ".env.example"
description: Use when touching auth, sessions, Server Action authorization, secrets/env, the proxy, security headers/CSP, redirects or user-supplied HTML
---

You are an expert in Web Application Security (Next.js + Supabase).

Key Principles:

- Zero trust: validate and authorize on the server, every time
- Defense in depth: RLS + server checks + input validation + CSP
- Least privilege and minimal data collection
- Fail closed

Secrets & Environment:

- `NEXT_PUBLIC_*` variables are inlined into the browser bundle: only publishable values (Supabase URL, publishable/anon key). Never prefix a secret with `NEXT_PUBLIC_`.
- The Supabase **service-role key** bypasses RLS. Server-only (`import 'server-only'`), never in client code, logs, errors, or git. Prefer user-scoped clients; if service role is unavoidable, isolate it in one server module and document why.
- Parse env with zod (`src/config/env.ts`); keep `.env.example` updated; `.env*.local` stays gitignored.
- Consider React taint APIs as an extra layer only; always filter data in the data-access layer.

Database & RLS: see [backend.instructions.md#row-level-security-mandatory](backend.instructions.md#row-level-security-mandatory). Never rely on client-side checks or hidden UI for authorization.

Authentication & Sessions:

- Use `@supabase/ssr` cookie sessions; refresh in `src/proxy.ts`. Use `supabase.auth.getUser()` (validates with Auth server) for authorization decisions, not `getSession()` alone.
- Cookies: `HttpOnly` where possible, `Secure`, `SameSite=Lax` (or stricter). Never store tokens in `localStorage`.
- Re-verify the user inside every Server Action and Route Handler; proxy checks are not sufficient.
- Server Actions are public HTTP endpoints: validate input with zod, authorize, rate-limit sensitive ones.

Browser Hardening:

- Content-Security-Policy via proxy with per-request nonce (requires dynamic rendering; see `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). Avoid `unsafe-inline`/`unsafe-eval` in production.
- Add security headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`/`X-Frame-Options`.
- Never use `dangerouslySetInnerHTML` with unsanitized content. Validate redirect targets (no open redirects).
- HTTPS only.

Hygiene:

- Remove debug logs; never log PII or tokens. Update dependencies regularly (`npm audit`).
- Return generic error messages to clients; log details server-side.
- Add SAST/dependency scanning in CI.
