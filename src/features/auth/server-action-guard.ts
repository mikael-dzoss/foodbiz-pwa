import "server-only";

import { requireManagerSession } from "@/lib/auth";
import {
  ACTION_FORBIDDEN_CODE,
  isOwnerRole,
  OwnerRequiredError,
  type ActionErrorCode,
  type ManagerSession,
} from "@/domain/auth";

export interface AuthenticatedActionContext {
  session: ManagerSession;
  businessId: string;
}

/**
 * Re-checks manager authentication inside a server action.
 * Enforces zero-trust defense in depth.
 */
export async function requireAuthenticatedAction(): Promise<AuthenticatedActionContext> {
  const session = await requireManagerSession();
  return {
    session,
    businessId: session.business.id,
  };
}

/**
 * Same as `requireAuthenticatedAction`, and additionally requires the signed-in member to be an
 * owner (payment settings, business slug, hard deletes). Throws `OwnerRequiredError`; callers turn
 * it into `forbiddenResult()`. The database enforces the same rule (RLS and trigger): this check
 * gives a typed answer instead of a database error and never replaces the database rule.
 */
export async function requireOwnerAction(): Promise<AuthenticatedActionContext> {
  const context = await requireAuthenticatedAction();
  if (!isOwnerRole(context.session.user.role)) {
    throw new OwnerRequiredError();
  }
  return context;
}

export interface ForbiddenActionResult {
  success: false;
  error: string;
  code: ActionErrorCode;
}

/** Typed refusal for a role that may not do this: fixed text plus the `FORBIDDEN` code. */
export function forbiddenResult(): ForbiddenActionResult {
  return { success: false, error: "Only an owner can do this.", code: ACTION_FORBIDDEN_CODE };
}

/** True for the error thrown by `requireOwnerAction` or by a repository that refused a non-owner. */
export function isForbiddenError(err: unknown): err is OwnerRequiredError {
  return err instanceof OwnerRequiredError;
}
