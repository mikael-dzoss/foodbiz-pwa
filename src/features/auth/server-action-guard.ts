import "server-only";

import { requireManagerSession } from "@/lib/auth";
import type { ManagerSession } from "@/domain/auth";

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
