import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { OrderRepoError } from "@/domain/order";
import { OwnerRequiredError } from "@/domain/auth";
import {
  requireAuthenticatedAction,
  requireOwnerAction,
  type AuthenticatedActionContext,
} from "@/features/auth";
import {
  ActionError,
  DEFAULT_ACTION_MESSAGES,
  type ActionCode,
  type ActionFailure,
  type ActionResult,
} from "./types";

export type ActionAuth = "public" | "manager" | "owner";

export interface ActionOptions<S extends z.ZodType, A extends ActionAuth> {
  /** Who may call it: anyone, a signed-in manager (default) or an owner. */
  auth?: A;
  /** Parses the raw input; omit for actions without input. */
  input?: S;
}

type HandlerContext<S extends z.ZodType, A extends ActionAuth> = {
  input: z.output<S>;
} & (A extends "manager" | "owner" ? AuthenticatedActionContext : object);

const fail = (code: ActionCode, message?: string, extra: Partial<ActionFailure> = {}) =>
  ({ ok: false, code, message: message ?? DEFAULT_ACTION_MESSAGES[code], ...extra }) as const;

/** Maps `OrderRepoError` codes (messages are vetted by the repository) to action codes. */
function fromOrderRepoError(err: OrderRepoError): ActionFailure {
  const extra = { reason: err.code, lineErrors: err.lineErrors };
  switch (err.code) {
    case "INVALID_INPUT":
      return fail("VALIDATION", err.message, extra);
    case "ORDER_NOT_FOUND":
    case "PRODUCT_NOT_FOUND":
      return fail("NOT_FOUND", err.message, extra);
    case "UNAUTHORIZED":
      return fail("FORBIDDEN", err.message, extra);
    case "RATE_LIMITED":
    case "ANTI_ABUSE_REJECTION":
      return fail("RATE_LIMITED", err.message, extra);
    case "INTERNAL_ERROR":
      return fail("INTERNAL");
    default:
      // ORDER_STATE_CONFLICT, STOCK_ERROR, STORE_CLOSED, ...: the request clashes with current state.
      return fail("CONFLICT", err.message, extra);
  }
}

function toFailure(name: string, err: unknown): ActionFailure {
  // redirect(), notFound() and request-time APIs throw control-flow errors: let Next handle them.
  unstable_rethrow(err);
  if (err instanceof ActionError) return fail(err.code, err.message, err.options);
  if (err instanceof OwnerRequiredError) return fail("FORBIDDEN");
  if (err instanceof OrderRepoError) return fromOrderRepoError(err);
  // Raw error text (database, network) stays on the server; ids only, no request data.
  console.error(`Server Action "${name}" failed:`, err instanceof Error ? err.name : typeof err);
  return fail("INTERNAL");
}

/** Groups zod issues by top-level field (what a form can show); form-level ones go under `form`. */
function issuesToFieldErrors(issues: readonly z.core.$ZodIssue[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/**
 * The one way to write a Server Action. In order it: checks auth (outside the try, so the login
 * redirect is never swallowed), parses the input with zod, runs the handler, and turns every
 * failure into an `ActionResult`: known domain errors keep their code and vetted message, Next
 * control-flow errors are rethrown, anything else is logged server-side and returned as `INTERNAL`
 * with fixed text. Handlers return data or throw `ActionError`.
 *
 * Add the `"use server"` directive to the file that exports the action.
 */
export function defineAction<
  T,
  S extends z.ZodType = z.ZodUndefined,
  A extends ActionAuth = "manager",
>(name: string, options: ActionOptions<S, A>, handler: (ctx: HandlerContext<S, A>) => Promise<T>) {
  const auth: ActionAuth = options.auth ?? "manager";

  return async (rawInput?: unknown): Promise<ActionResult<T>> => {
    let context: AuthenticatedActionContext | null = null;
    if (auth !== "public") {
      try {
        context = await (auth === "owner" ? requireOwnerAction() : requireAuthenticatedAction());
      } catch (err) {
        // A redirect to login propagates; only a role refusal becomes a result.
        if (err instanceof OwnerRequiredError) return fail("FORBIDDEN");
        throw err;
      }
    }

    let input: unknown = undefined;
    if (options.input) {
      const parsed = options.input.safeParse(rawInput);
      if (!parsed.success) {
        return fail("VALIDATION", parsed.error.issues.map((i) => i.message).join(", "), {
          fieldErrors: issuesToFieldErrors(parsed.error.issues),
        });
      }
      input = parsed.data;
    }

    try {
      const data = await handler({ input, ...context } as HandlerContext<S, A>);
      return { ok: true, data };
    } catch (err) {
      return toFailure(name, err);
    }
  };
}
