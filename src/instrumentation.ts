import type { Instrumentation } from "next";
import { logEvent, type LogFields } from "@/lib/log";

type RequestErrorArgs = Parameters<Instrumentation.onRequestError>;

const STACK_LIMIT = 2000;

function isProductionDeployment(): boolean {
  const appEnv = process.env.APP_ENV;
  return process.env.NODE_ENV === "production" && appEnv !== "development" && appEnv !== "test";
}

/**
 * Structured fields for a server error. Only the route template (`routePath`) is logged, never the
 * concrete path: paths and query strings can carry order-tracking tokens or phone numbers. In
 * production the message and stack are left out too (database errors can echo row values); Next
 * still prints the original error, and `digest` links the two.
 */
export function requestErrorFields(
  error: RequestErrorArgs[0],
  request: RequestErrorArgs[1],
  context: RequestErrorArgs[2],
  production: boolean,
): LogFields {
  const err = error instanceof Error ? error : undefined;
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  return {
    errorName: err?.name ?? typeof error,
    digest,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
    ...(production ? {} : { message: err?.message, stack: err?.stack?.slice(0, STACK_LIMIT) }),
  };
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logEvent(
    "error",
    "request_error",
    requestErrorFields(error, request, context, isProductionDeployment()),
  );
};
