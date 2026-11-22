/**
 * The one result shape of every Server Action (see `defineAction`). Safe to import from client
 * code: no server-only dependency.
 */

/** Closed set of failure codes; clients map them to dictionary messages. */
export const ACTION_CODES = [
  "VALIDATION",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
] as const;

export type ActionCode = (typeof ACTION_CODES)[number];

export interface ActionFailure {
  readonly ok: false;
  readonly code: ActionCode;
  /** User-safe text (vetted domain wording or a fixed default); never raw database text. */
  readonly message: string;
  /** Optional stable domain sub-code a UI can act on, e.g. `ORDER_STATE_CONFLICT`, `STOCK_ERROR`. */
  readonly reason?: string;
  /** Per-field messages for forms, keyed by top-level input field. */
  readonly fieldErrors?: Record<string, string[]>;
  /** Per-line messages (keyed by product id) for order lines. */
  readonly lineErrors?: Record<string, string>;
}

export type ActionResult<T = void> = { readonly ok: true; readonly data: T } | ActionFailure;

export const DEFAULT_ACTION_MESSAGES: Record<ActionCode, string> = {
  VALIDATION: "Please check the details and try again.",
  UNAUTHENTICATED: "Please sign in again.",
  FORBIDDEN: "Only an owner can do this.",
  NOT_FOUND: "We could not find that.",
  CONFLICT: "This changed in the meantime. Please reload and try again.",
  RATE_LIMITED: "Too many attempts. Please try again later.",
  INTERNAL: "Something went wrong. Please try again.",
};

export interface ActionErrorOptions {
  reason?: string;
  fieldErrors?: Record<string, string[]>;
  lineErrors?: Record<string, string>;
}

/** Throw from a handler to refuse with a code and a user-safe message. */
export class ActionError extends Error {
  readonly code: ActionCode;
  readonly options: ActionErrorOptions;

  constructor(code: ActionCode, message?: string, options: ActionErrorOptions = {}) {
    super(message ?? DEFAULT_ACTION_MESSAGES[code]);
    this.name = "ActionError";
    this.code = code;
    this.options = options;
  }
}
