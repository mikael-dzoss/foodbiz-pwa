import "server-only";

import { requireManagerSession } from "@/lib/auth";
import { isOwnerRole, OwnerRequiredError, type ManagerSession } from "@/domain/auth";

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
 * owner (payment settings, business slug, hard deletes). Throws `OwnerRequiredError`; `defineAction`
 * turns it into a `FORBIDDEN` result. The database enforces the same rule (RLS and trigger): this check
 * gives a typed answer instead of a database error and never replaces the database rule.
 */
export async function requireOwnerAction(): Promise<AuthenticatedActionContext> {
  const context = await requireAuthenticatedAction();
  if (!isOwnerRole(context.session.user.role)) {
    throw new OwnerRequiredError();
  }
  return context;
}
