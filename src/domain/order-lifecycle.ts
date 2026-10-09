import type { OrderStatus, PaidStatus } from "./order";

export const ALLOWED_ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export type TransitionResult = { ok: true } | { ok: false; error: string };

export interface OrderTransitionParams {
  currentStatus: OrderStatus;
  nextStatus: OrderStatus;
  paid?: PaidStatus | null;
  reason?: string | null;
}

export function getNextAllowedStatuses(currentStatus: OrderStatus): readonly OrderStatus[] {
  return ALLOWED_ORDER_TRANSITIONS[currentStatus] ?? [];
}

export function validateOrderTransition(params: OrderTransitionParams): TransitionResult;
export function validateOrderTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  context?: { paid?: PaidStatus | null; reason?: string | null },
): TransitionResult;
export function validateOrderTransition(
  first: OrderStatus | OrderTransitionParams,
  second?: OrderStatus,
  third?: { paid?: PaidStatus | null; reason?: string | null },
): TransitionResult {
  const currentStatus = typeof first === "object" ? first.currentStatus : first;
  const nextStatus = typeof first === "object" ? first.nextStatus : (second as OrderStatus);
  const paid = typeof first === "object" ? first.paid : third?.paid;
  const reason = typeof first === "object" ? first.reason : third?.reason;

  if (currentStatus === nextStatus) {
    return {
      ok: false,
      error: `Order is already in ${currentStatus} status.`,
    };
  }

  const allowed = ALLOWED_ORDER_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    return {
      ok: false,
      error: `Cannot transition order from ${currentStatus} to ${nextStatus}.`,
    };
  }

  if (currentStatus === "NEW" && nextStatus === "CANCELLED") {
    if (!reason || reason.trim().length === 0) {
      return {
        ok: false,
        error: "A reason is required when rejecting a new order.",
      };
    }
  }

  if (nextStatus === "COMPLETED") {
    if (paid !== "paid") {
      return {
        ok: false,
        error: "Cannot transition to COMPLETED while order is unpaid.",
      };
    }
  }

  return { ok: true };
}

export const transitionOrderStatus = validateOrderTransition;
